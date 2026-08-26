import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';

import connectDB from './config/db.js';
import { startRegularizationAutoApprover } from './graphql/resolvers/regularization.resolvers.js';
import { startLeaveAccrualScheduler } from './services/leaveAccrual.service.js';
import { startPunchReminderScheduler } from './services/punchReminder.service.js';
import './config/environment.js';
import typeDefs from './graphql/typeDefs.js';
import resolvers from './graphql/resolvers/index.js';
import { getAuthUser } from './middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startServer = async () => {
  // ── Boot-time secret guard ──
  // Refuse to run without a real JWT secret – tokens signed with an undefined
  // key would be an instant account-takeover vector.
  if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET is not set in the environment. Refusing to start.');
    process.exit(1);
  }

  await connectDB();

  const app = express();

  // ── Standard HTTP security headers ──
  // CSP stays disabled: GraphQL Playground/landing page needs inline scripts.
  app.use(helmet({ contentSecurityPolicy: false }));

  const httpServer = http.createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        const token = ctx.connectionParams?.authorization || ctx.connectionParams?.Authorization || '';
        const user = await getAuthUser(token);
        return { user };
      },
    },
    wsServer
  );

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
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
      console.error('GraphQL Error:', err);
      return err;
    },
  });

  await server.start();

  app.disable('x-powered-by');
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  app.use((_, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(
    '/graphql',
    cors({
      // Lock down in production via CORS_ORIGIN=https://app.example.com (comma-separated)
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : true,
    }),
    // Global abuse brake – login/signup have their own stricter limits inside
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: true,
      legacyHeaders: false,
      message: { errors: [{ message: 'Too many requests – please slow down.' }] },
    }),
    express.json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const token = req.headers.authorization || '';
        const user = await getAuthUser(token);
        return { user };
      },
    })
  );

  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`🚀 WebSockets ready at ws://localhost:${PORT}/graphql`);
    startRegularizationAutoApprover();
    startLeaveAccrualScheduler();
    startPunchReminderScheduler();
  });
};

startServer().catch((err) => {
  console.error('Server failed to start', err);
  process.exit(1);
});
