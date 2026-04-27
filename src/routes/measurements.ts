import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Zone, Sensor, Measurement } from '../db/models';
import { generateTemperature, generateHumidity } from '../simulation/sensors';
import { ISensor } from '../db/models';
import { requireRole, requireZoneAccess } from '../middleware/auth';

const router = Router({ mergeParams: true });

interface SensorP { buildingId: string; zoneId: string; sensorId: string }

const VALID_TYPES = ['temperature', 'humidity'];

type ResolveError = { ok: false; status: number; message: string };
type ResolveOk    = { ok: true; sensor: NonNullable<Awaited<ReturnType<typeof Sensor.findOne>>> };

async function resolveSensor(buildingId: string, zoneId: string, sensorId: string): Promise<ResolveError | ResolveOk> {
  const zone = await Zone.findOne({ _id: zoneId, buildingId });
  if (!zone) return { ok: false, status: 404, message: 'Zone introuvable' };
  const sensor = await Sensor.findOne({ _id: sensorId, zoneId });
  if (!sensor) return { ok: false, status: 404, message: 'Capteur introuvable' };
  return { ok: true, sensor };
}

// GET /buildings/:buildingId/zones/:zoneId/sensors/:sensorId/measurements
// BFLA: admin + operator | BOLA: sa zone uniquement
router.get('/', requireRole('admin', 'operator'), requireZoneAccess, async (req: Request, res: Response) => {
  const { buildingId, zoneId, sensorId } = req.params as unknown as SensorP;
  const result = await resolveSensor(buildingId, zoneId, sensorId);
  if (!result.ok) { res.status(result.status).json({ error: 'not_found', message: result.message }); return; }

  if (result.sensor.status === 'offline') {
    res.status(503).json({ error: 'device_unavailable', message: `Le capteur ${sensorId} est hors ligne`, sensor_id: sensorId, retry_after: 60 });
    return;
  }

  const measurements = await Measurement.find({ sensorId }).sort({ timestamp: -1 });
  res.json(measurements);
});

// POST /buildings/:buildingId/zones/:zoneId/sensors/:sensorId/measurements
// BFLA: admin + device (opérateurs ne postent pas de mesures) | BOLA: sa zone
router.post('/', requireRole('admin', 'device'), requireZoneAccess, async (req: Request, res: Response) => {
  const { buildingId, zoneId, sensorId } = req.params as unknown as SensorP;
  const result = await resolveSensor(buildingId, zoneId, sensorId);
  if (!result.ok) { res.status(result.status).json({ error: 'not_found', message: result.message }); return; }

  const { sensor } = result;

  if (sensor.status === 'offline' || sensor.status === 'maintenance') {
    res.status(503).json({ error: 'device_unavailable', message: `Le capteur ${sensorId} est en état ${sensor.status}`, sensor_id: sensorId, retry_after: 60 });
    return;
  }

  const { type, value, unit } = req.body;

  let measType: 'temperature' | 'humidity';
  let measValue: number;
  let measUnit: string;

  if (value !== undefined && type) {
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'validation_error', message: `type doit être parmi : ${VALID_TYPES.join(', ')}` }); return;
    }
    measType = type;
    measValue = Number(value);
    measUnit = unit ?? (type === 'temperature' ? '°C' : '%');
  } else {
    const sensorPlain = sensor.toObject() as ISensor;
    if (sensorPlain.type === 'humidity') {
      measType = 'humidity'; measValue = generateHumidity(sensorPlain); measUnit = '%';
    } else {
      measType = 'temperature'; measValue = generateTemperature(sensorPlain); measUnit = '°C';
    }
  }

  const measurement = await Measurement.create({ _id: uuidv4(), sensorId, type: measType, value: measValue, unit: measUnit, timestamp: new Date().toISOString() });
  res.status(201).json(measurement);
});

export default router;
