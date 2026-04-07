import { expressjwt } from 'express-jwt';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from 'express-jwt';

export const verifyJWT = expressjwt({
  secret: process.env.JWT_SECRET!,
  algorithms: ['HS256'],
  audience: 'thermosense-api',
  issuer: 'thermosense',
});

export function jwtErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof UnauthorizedError) {
    const reason = err.inner?.message ?? err.message;
    console.warn(`[auth] rejet sub=unknown reason="${reason}"`);
    res.status(401).json({
      error: 'unauthorized',
      message: reason,
    });
    return;
  }
  next(err);
}
