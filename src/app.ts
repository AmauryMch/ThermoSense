import express from 'express';
import buildingsRouter from './routes/buildings';
import zonesRouter from './routes/zones';
import sensorsRouter from './routes/sensors';
import measurementsRouter from './routes/measurements';
import actuatorsRouter from './routes/actuators';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import { verifyJWT, jwtErrorHandler } from './middleware/auth';
import { securityAuditContext } from './middleware/securityAudit';
import { createRateLimiter } from './middleware/rateLimit';
import { notFound, errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json());
app.use(securityAuditContext);
app.use('/auth/login', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }));

// Middleware JWT — exclut explicitement les routes publiques
app.use(
  verifyJWT.unless({
    path: [
      { url: '/auth/login', methods: ['POST'] },
      { url: '/health',     methods: ['GET']  },
    ],
  })
);
app.use(jwtErrorHandler);

// Routes
app.use('/auth',       authRouter);
app.use('/users',      usersRouter);
app.use('/buildings',  buildingsRouter);
app.use('/buildings/:buildingId/zones',                                     zonesRouter);
app.use('/buildings/:buildingId/zones/:zoneId/sensors',                     sensorsRouter);
app.use('/buildings/:buildingId/zones/:zoneId/sensors/:sensorId/measurements', measurementsRouter);
app.use('/buildings/:buildingId/zones/:zoneId/actuators',                   actuatorsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(notFound);
app.use(errorHandler);

export default app;
