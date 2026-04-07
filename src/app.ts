import express from 'express';
import buildingsRouter from './routes/buildings';
import zonesRouter from './routes/zones';
import sensorsRouter from './routes/sensors';
import measurementsRouter from './routes/measurements';
import actuatorsRouter from './routes/actuators';
import { notFound, errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json());

// Routes
app.use('/buildings', buildingsRouter);
app.use('/buildings/:buildingId/zones', zonesRouter);
app.use('/buildings/:buildingId/zones/:zoneId/sensors', sensorsRouter);
app.use('/buildings/:buildingId/zones/:zoneId/sensors/:sensorId/measurements', measurementsRouter);
app.use('/buildings/:buildingId/zones/:zoneId/actuators', actuatorsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(notFound);
app.use(errorHandler);

export default app;
