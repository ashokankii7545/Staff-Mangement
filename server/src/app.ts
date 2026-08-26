import path from 'path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { expressMiddleware } from '@apollo/server/express4';
import type { ApolloServer } from '@apollo/server';
import { env } from './config/env.js';
import { buildHttpContext } from './graphql/context.js';

/** Global abuse brake – login/signup have their own stricter limits inside. */
const graphqlRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errors: [{ message: 'Too many requests – please slow down.' }] },
});

/**
 * Core HTTP surface: security headers + static uploads.
 * GraphQL endpoint attaches later (after Apollo starts) via attachGraphql.
 */
export const createBaseApp = (): Express => {
  const app = express();

  // ── Standard HTTP security headers ──
  // CSP stays disabled: GraphQL landing page needs inline scripts.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.disable('x-powered-by');

  // Serve uploaded selfies/documents.
  app.use('/uploads', express.static(path.join(process.cwd(), env.uploadDir)));

  // Extra hardening headers.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  return app;
};

/** Mount the GraphQL endpoint (call once the Apollo server has started). */
export const attachGraphql = (
  app: Express,
  apollo: ApolloServer,
): void => {
  app.use(
    '/graphql',
    cors({
      // Locked down in production via CORS_ORIGIN (comma-separated list).
      origin: env.corsOrigins ?? true,
    }),
    graphqlRateLimiter,
    express.json({ limit: '10mb' }),
    expressMiddleware(apollo, {
      context: buildHttpContext,
    }),
  );
};
