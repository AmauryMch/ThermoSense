import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../db/models';
import { logSecurityEvent } from '../middleware/securityAudit';

const router = Router();

function scopeForRole(role: string): string {
  switch (role) {
    case 'admin':    return 'thermosense:admin';
    case 'operator': return 'thermosense:read thermosense:write';
    case 'device':   return 'thermosense:write';
    default:         return 'thermosense:read';
  }
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'missing_credentials', message: 'username et password requis' });
    return;
  }

  const user = await User.findOne({ username });

  if (!user || !user.passwordHash) {
    logSecurityEvent(req, res, 'auth_failed', 'invalid_credentials', {
      actor: `user:${username}`,
      level: 'warn',
    });
    res.status(401).json({ error: 'invalid_credentials', message: 'Identifiants invalides' });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    logSecurityEvent(req, res, 'auth_failed', 'invalid_credentials', {
      actor: `user:${username}`,
      level: 'warn',
    });
    res.status(401).json({ error: 'invalid_credentials', message: 'Identifiants invalides' });
    return;
  }

  const token = jwt.sign(
    {
      role:  user.role,
      scope: scopeForRole(user.role),
      ...(user.zoneId ? { zoneId: user.zoneId } : {}),
    },
    process.env.JWT_SECRET!,
    {
      subject:   user._id.toString(),
      audience:  'thermosense-api',
      issuer:    'thermosense',
      expiresIn: '15m',
    }
  );

  console.log(`[auth] login ok sub=${user._id} role=${user.role}`);
  res.json({ token });
});

export default router;
