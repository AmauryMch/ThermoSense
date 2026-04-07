import { Request, Response, NextFunction } from 'express';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: 'not_found',
    message: `Route ${req.method} ${req.path} introuvable`,
  });
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);
  res.status(500).json({
    error: 'internal_server_error',
    message: err.message,
  });
}
