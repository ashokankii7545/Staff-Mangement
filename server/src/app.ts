import path from 'path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { expressMiddleware } from '@apollo/server/express4';
import type { ApolloServer, BaseContext } from '@apollo/server';
import { env } from './config/env.js';
import { database } from './config/db.js';
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

  // Behind nginx/Render/Railway: req.ip must be the REAL client IP,
  // otherwise the rate limiter buckets everyone and VPN checks break.
  app.set('trust proxy', 1);

  // "?"? Standard HTTP security headers "?"?
  // CSP stays disabled: GraphQL landing page needs inline scripts.
  app.use(helmet({ 
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  app.disable('x-powered-by');

  // Liveness probe for hosts (Render/Railway/Docker healthchecks).
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: env.nodeEnv,
    });
  });

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
  apollo: ApolloServer<any>,
): void => {
  app.use(
    '/graphql',
    cors({
      // Reflect request origin (safest fallback if Vercel env var has typos)
      origin: true,
      credentials: true,
    }),
    graphqlRateLimiter,
    express.json({ limit: '10mb' }),
    expressMiddleware(apollo, {
      context: buildHttpContext,
    }),
  );

  // JSON 404 fallback – must stay LAST so GraphQL routes match first.
  app.use((_req, res) => {
    res.status(404).json({ errors: [{ message: 'Route not found.' }] });
  });
};
