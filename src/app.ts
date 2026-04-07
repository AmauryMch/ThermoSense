import express from 'express';
import buildingsRouter from './routes/buildings';
import zonesRouter from './routes/zones';
import sensorsRouter from './routes/sensors';
import measurementsRouter from './routes/measurements';
import actuatorsRouter from './routes/actuators';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import { verifyJWT, jwtErrorHandler } from './middleware/auth';
import { notFound, errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json());

// Routes publiques
app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware JWT — protège tout ce qui suit
app.use(verifyJWT);
app.use(jwtErrorHandler);

// Routes protégées
app.use('/users', usersRouter);
app.use('/buildings', buildingsRouter);
app.use('/buildings/:buildingId/zones', zonesRouter);
app.use('/buildings/:buildingId/zones/:zoneId/sensors', sensorsRouter);
app.use('/buildings/:buildingId/zones/:zoneId/sensors/:sensorId/measurements', measurementsRouter);
app.use('/buildings/:buildingId/zones/:zoneId/actuators', actuatorsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
