import { expressjwt } from 'express-jwt';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from 'express-jwt';
import { logSecurityEvent } from './securityAudit';

export interface AuthPayload {
  sub: string;
  role: 'admin' | 'operator' | 'device';
  scope: string;
  zoneId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export const verifyJWT = expressjwt({
  secret: process.env.JWT_SECRET!,
  algorithms: ['HS256'],
  audience: 'thermosense-api',
  issuer: 'thermosense',
});

function normalizeJwtReason(reason: string): string {
  if (/expired/i.test(reason)) return 'token_expired';
  if (/no authorization token/i.test(reason)) return 'missing_token';
  return 'invalid_token';
}

export function jwtErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof UnauthorizedError) {
    const reason = err.inner?.message ?? err.message;
    logSecurityEvent(_req, res, 'auth_failed', normalizeJwtReason(reason), { level: 'warn' });
    res.status(401).json({ code: 'unauthorized', message: reason });
    return;
  }
  next(err);
}

// BFLA — vérifie que le rôle de l'appelant est dans la liste autorisée
export function requireRole(...roles: Array<'admin' | 'operator' | 'device'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { role, sub } = req.auth!;
    if (!roles.includes(role)) {
      logSecurityEvent(req, res, 'access_denied', 'role_insufficient', {
        actor: `user:${sub}`,
        level: 'warn',
      });
      res.status(403).json({
        code: 'role_insufficient',
        message: `Action réservée aux rôles : ${roles.join(', ')}`,
      });
      return;
    }
    next();
  };
}

// BOLA — vérifie que l'utilisateur accède à sa propre zone (admin exempt)
export function requireZoneAccess(req: Request, res: Response, next: NextFunction): void {
  const { role, sub, zoneId: userZone } = req.auth!;
  if (role === 'admin') { next(); return; }

  const targetZone = (req.params as Record<string, string>).zoneId;
  if (targetZone && userZone !== targetZone) {
    logSecurityEvent(req, res, 'access_denied', 'object_not_owned', {
      actor: `user:${sub}`,
      level: 'warn',
    });
    res.status(403).json({
      code: 'object_not_owned',
      message: 'Accès refusé — cette zone ne vous appartient pas',
    });
    return;
  }
  next();
}
