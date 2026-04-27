import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export type SecurityEvent = 'auth_failed' | 'access_denied' | 'rate_limited';
export type SecurityLevel = 'warn' | 'error';

type SecurityLogEntry = {
  timestamp: string;
  level: SecurityLevel;
  event: SecurityEvent;
  actor: string;
  endpoint: string;
  reason: string;
  correlation_id: string;
};

type SecurityAuditState = {
  correlationId: string;
  logged: boolean;
};

declare global {
  namespace Express {
    interface Response {
      locals: {
        securityAuditState?: SecurityAuditState;
        [key: string]: unknown;
      };
    }
  }
}

function normalizeEndpoint(req: Request): string {
  return `${req.method} ${req.originalUrl.split('?')[0]}`;
}

function resolveActor(req: Request, explicitActor?: string): string {
  if (explicitActor) return explicitActor;
  const auth = req.auth;
  if (auth?.sub) return `user:${auth.sub}`;
  return `ip:${req.ip}`;
}

function resolveReason(event: SecurityEvent, statusCode: number): string {
  if (event === 'auth_failed' && statusCode === 401) return 'invalid_credentials';
  if (event === 'access_denied' && statusCode === 403) return 'forbidden';
  if (event === 'rate_limited' && statusCode === 429) return 'too_many_requests';
  return 'unknown';
}

function emitSecurityLog(req: Request, res: Response, entry: Omit<SecurityLogEntry, 'timestamp' | 'correlation_id'>): void {
  const state = res.locals.securityAuditState;
  if (!state || state.logged) return;

  const payload: SecurityLogEntry = {
    timestamp: new Date().toISOString(),
    correlation_id: state.correlationId,
    ...entry,
  };

  const line = JSON.stringify(payload);
  if (payload.level === 'error') {
    console.error(line);
  } else {
    console.warn(line);
  }

  state.logged = true;
}

export function securityAuditContext(req: Request, res: Response, next: NextFunction): void {
  const incomingCorrelationId = req.header('x-correlation-id')?.trim();
  const correlationId = incomingCorrelationId || randomUUID();

  res.locals.securityAuditState = {
    correlationId,
    logged: false,
  };

  res.setHeader('x-correlation-id', correlationId);

  res.on('finish', () => {
    const state = res.locals.securityAuditState;
    if (!state || state.logged) return;

    if (res.statusCode === 401) {
      emitSecurityLog(req, res, {
        level: 'warn',
        event: 'auth_failed',
        actor: resolveActor(req),
        endpoint: normalizeEndpoint(req),
        reason: resolveReason('auth_failed', res.statusCode),
      });
      return;
    }

    if (res.statusCode === 403) {
      emitSecurityLog(req, res, {
        level: 'warn',
        event: 'access_denied',
        actor: resolveActor(req),
        endpoint: normalizeEndpoint(req),
        reason: resolveReason('access_denied', res.statusCode),
      });
      return;
    }

    if (res.statusCode === 429) {
      emitSecurityLog(req, res, {
        level: 'warn',
        event: 'rate_limited',
        actor: resolveActor(req),
        endpoint: normalizeEndpoint(req),
        reason: resolveReason('rate_limited', res.statusCode),
      });
    }
  });

  next();
}

export function logSecurityEvent(
  req: Request,
  res: Response,
  event: SecurityEvent,
  reason: string,
  options: { actor?: string; level?: SecurityLevel } = {}
): void {
  emitSecurityLog(req, res, {
    level: options.level ?? 'warn',
    event,
    actor: resolveActor(req, options.actor),
    endpoint: normalizeEndpoint(req),
    reason,
  });
}
