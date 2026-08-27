import http from 'http';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';

import { env } from './config/env.js';
import { database } from './config/db.js';
import { logger } from './shared/logger/logger.js';
import { mailer } from './shared/mail/mailer.js';
import { schema } from './graphql/schema.js';
import { buildWsContext } from './graphql/context.js';
import { createBaseApp, attachGraphql } from './app.js';
import { startRegularizationAutoApprover } from './jobs/regularization-auto-approve.job.js';
import { startLeaveAccrualScheduler } from './jobs/leave-accrual.job.js';
import { startPunchReminderScheduler } from './jobs/punch-reminder.job.js';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * APPLICATION – SINGLETON orchestrator for the whole backend runtime
 * ────────────────────────────────────────────────────────────────────────────
 * Owns: DB connection · HTTP server · WS subscription server · Apollo Server ·
 * background jobs · graceful shutdown. Boot order matters & lives here only.
 */
class Application {
  private static instance: Application | null = null;

  private httpServer?: http.Server;
  private apollo?: ApolloServer;
  private wsCleanup?: () => Promise<void>;

  private constructor() {}

  public static getInstance(): Application {
    if (!Application.instance) {
      Application.instance = new Application();
    }
    return Application.instance;
  }

  public async start(): Promise<void> {
    logger.info(`Booting AttendEase API (${env.nodeEnv})…`);
    logger.info(
      `Face service: ${env.faceServiceUrl ? env.faceServiceUrl : 'DISABLED (FACE_SERVICE_URL empty)'}`,
    );

    if (env.nodeEnv === 'production' && !mailer.configured) {
      // Loud, early warning – password-reset mails silently no-op otherwise.
      logger.warn('SMTP not configured – ALL emails will only be logged to the console!');
    }

    // 1. Database first – nothing works without it.
    await database.connect();

    // 2. Core app + shared HTTP listener (WS & REST/GraphQL share the port).
    const app = createBaseApp();
    this.httpServer = http.createServer(app);

    const wsServer = new WebSocketServer({ server: this.httpServer, path: '/graphql' });
    const serverCleanup = useServer(
      { schema, context: (ctx) => buildWsContext(ctx) },
      wsServer,
    );
    this.wsCleanup = async () => {
      await serverCleanup.dispose();
    };

    // 3. Apollo with clean drain for BOTH http & ws transports.
    this.apollo = new ApolloServer({
      schema,
      // Hardening: hide the API surface (introspection/landing page) in prod.
      introspection: env.nodeEnv !== 'production',
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer: this.httpServer }),
        {
          async serverWillStart() {
            return {
              async drainServer() {
                await serverCleanup.dispose();
              },
            };
          },
        },
      ],
      formatError: (err) => {
        // APQ handshakes after every dev restart are NORMAL protocol flow –
        // don't spam the console with them.
        if (err?.extensions?.code === 'PERSISTED_QUERY_NOT_FOUND') return err;
        logger.error(`GraphQL Error [${err?.extensions?.code ?? 'UNKNOWN'}]:`, err.message);
        return err;
      },
    });

    await this.apollo.start();

    // 4. Mount GraphQL middleware now that Apollo is live.
    attachGraphql(app, this.apollo);

    // 5. Listen.
    this.httpServer.listen(env.port, () => {
      logger.info(`🚀 GraphQL ready   → http://localhost:${env.port}/graphql`);
      logger.info(`🚀 Subscriptions    → ws://localhost:${env.port}/graphql`);

      // 6. Background jobs last – they assume a live DB.
      startRegularizationAutoApprover();
      startLeaveAccrualScheduler();
      startPunchReminderScheduler();
    });

    process.on('SIGINT', () => void this.shutdown());
    process.on('SIGTERM', () => void this.shutdown());
  }

  public async shutdown(): Promise<void> {
    logger.info('Graceful shutdown initiated…');
    try {
      if (this.wsCleanup) await this.wsCleanup();
      await this.apollo?.stop();
      await new Promise<void>((resolve) => {
        if (!this.httpServer) return resolve();
        this.httpServer.close(() => resolve());
      });
      await database.disconnect();
      logger.info('Shutdown complete. Bye 👋');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }
}

// ── Process-level resilience ────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  // Log loudly but keep serving – a rejected promise somewhere in a
  // fire-and-forget email/notification should never kill the API.
  logger.error('Unhandled promise rejection', reason);
});
process.on('uncaughtException', (err) => {
  // Node docs: state is undefined after uncaughtException – exit gracefully.
  logger.error('Uncaught exception – initiating shutdown', err);
  void Application.getInstance().shutdown();
});

// ── Bootstrap ───────────────────────────────────────────────────────────────
Application.getInstance()
  .start()
  .catch((err: unknown) => {
    logger.error('Server failed to start', err);
    process.exit(1);
  });

