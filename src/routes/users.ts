import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../db/models';

const router = Router();

// POST /users — créer un utilisateur
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { username, password, role, zoneId } = req.body;

  if (!username || !password || !role) {
    res.status(400).json({
      error: 'missing_fields',
      message: 'username, password et role sont requis',
    });
    return;
  }

  const VALID_ROLES = ['admin', 'operator', 'device'];
  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({
      error: 'invalid_role',
      message: `role doit être l'un de : ${VALID_ROLES.join(', ')}`,
    });
    return;
  }

  const existing = await User.findOne({ username });
  if (existing) {
    res.status(409).json({
      error: 'conflict',
      message: `L'utilisateur "${username}" existe déjà`,
    });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({
    _id:  uuidv4(),
    username,
    passwordHash,
    role,
    ...(zoneId ? { zoneId } : {}),
  });

  console.log(`[users] création sub=${user._id} username=${username} role=${role}`);

  res.status(201).json({
    id:       user._id,
    username: user.username,
    role:     user.role,
    ...(user.zoneId ? { zoneId: user.zoneId } : {}),
  });
});

export default router;
