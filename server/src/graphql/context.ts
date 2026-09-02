import type { Request } from 'express';
import { getAuthUser } from '../shared/guards/auth.guard.js';
import type { IUserDocument } from '../modules/user/user.model.js';
import { createDataLoaders, type DataLoaders } from '../shared/utils/dataloader.js';

/** Shape of the GraphQL execution context every resolver receives. */
export interface ContextValue {
  user: IUserDocument | null;
  clientIp: string;
  hostname: string;
  origin: string;
  loaders: DataLoaders;
}

/** Best-effort client IP (proxy-aware) for rate limiting & VPN checks. */
export const extractClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? '';
};

/** HTTP context factory used by expressMiddleware. */
export const buildHttpContext = async ({ req }: { req: Request }): Promise<ContextValue> => {
  const user = await getAuthUser(req.headers.authorization);
  
  const originStr = req.headers.origin ?? `http://${req.headers.host}`;
  let clientHostname = req.hostname;
  try {
    const url = new URL(originStr);
    clientHostname = url.hostname;
  } catch (e) {
    // fallback if URL parsing fails
  }

  return { 
    user, 
    clientIp: extractClientIp(req), 
    hostname: clientHostname,
    origin: originStr,
    loaders: createDataLoaders() 
  };
};

/** WebSocket context factory used by graphql-ws useServer(). */
export const buildWsContext = async (ctx: {
  connectionParams?: Record<string, unknown> | undefined;
}): Promise<ContextValue> => {
  const params = (ctx.connectionParams ?? {}) as Record<string, unknown>;
  const token =
    (params.authorization as string | undefined) ?? (params.Authorization as string | undefined) ?? '';
  const user = await getAuthUser(token);

  // Note: the socket object type depends on the server (e.g. uWebSockets vs Node).
  // We provide a fallback for the IP since WebSocket headers can be tricky.
  return { 
    user, 
    clientIp: '', 
    hostname: 'localhost',
    origin: 'http://localhost',
    loaders: createDataLoaders() 
  };
};
