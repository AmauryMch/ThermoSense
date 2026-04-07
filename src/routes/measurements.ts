import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../data/store';
import { Measurement, MeasurementType } from '../types';
import { generateTemperature, generateHumidity } from '../simulation/sensors';

const router = Router({ mergeParams: true });

interface SensorParams { buildingId: string; zoneId: string; sensorId: string }

const VALID_TYPES: MeasurementType[] = ['temperature', 'humidity'];

// GET /buildings/:buildingId/zones/:zoneId/sensors/:sensorId/measurements
router.get('/', (req: Request<SensorParams>, res: Response) => {
  const { buildingId, zoneId, sensorId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const sensor = store.sensors.get(sensorId);
  if (!sensor || sensor.zoneId !== zoneId) {
    res.status(404).json({ error: 'not_found', message: 'Capteur introuvable' });
    return;
  }

  if (sensor.status === 'offline') {
    res.status(503).json({
      error: 'device_unavailable',
      message: `Le capteur ${sensorId} est hors ligne`,
      sensor_id: sensorId,
      retry_after: 60,
    });
    return;
  }

  const measurements = store.measurements
    .filter((m) => m.sensorId === sensorId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json(measurements);
});

// POST /buildings/:buildingId/zones/:zoneId/sensors/:sensorId/measurements
router.post('/', (req: Request<SensorParams>, res: Response) => {
  const { buildingId, zoneId, sensorId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const sensor = store.sensors.get(sensorId);
  if (!sensor || sensor.zoneId !== zoneId) {
    res.status(404).json({ error: 'not_found', message: 'Capteur introuvable' });
    return;
  }

  if (sensor.status === 'offline' || sensor.status === 'maintenance') {
    res.status(503).json({
      error: 'device_unavailable',
      message: `Le capteur ${sensorId} est en état ${sensor.status} — ingestion impossible`,
      sensor_id: sensorId,
      retry_after: 60,
    });
    return;
  }

  const { type, value, unit } = req.body;

  let measType: MeasurementType;
  let measValue: number;
  let measUnit: string;

  if (value !== undefined && type) {
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({
        error: 'validation_error',
        message: `Le type doit être parmi : ${VALID_TYPES.join(', ')}`,
      });
      return;
    }
    measType = type;
    measValue = Number(value);
    measUnit = unit ?? (type === 'temperature' ? '°C' : '%');
  } else {
    // Simulation automatique si aucune valeur fournie
    if (sensor.type === 'humidity') {
      measType = 'humidity';
      measValue = generateHumidity(sensor);
      measUnit = '%';
    } else {
      measType = 'temperature';
      measValue = generateTemperature(sensor);
      measUnit = '°C';
    }
  }

  const measurement: Measurement = {
    id: uuidv4(),
    sensorId,
    type: measType,
    value: measValue,
    unit: measUnit,
    timestamp: new Date().toISOString(),
  };

  store.measurements.push(measurement);
  res.status(201).json(measurement);
});

export default router;
