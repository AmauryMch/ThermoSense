import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../data/store';
import { Sensor, SensorType, SensorStatus } from '../types';

const router = Router({ mergeParams: true });

interface ZoneParams { buildingId: string; zoneId: string }
interface SensorParams { buildingId: string; zoneId: string; sensorId: string }

const VALID_TYPES: SensorType[] = ['temperature', 'humidity', 'both'];
const VALID_STATUSES: SensorStatus[] = ['active', 'faulty', 'maintenance', 'offline'];

// GET /buildings/:buildingId/zones/:zoneId/sensors
router.get('/', (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const sensors = Array.from(store.sensors.values()).filter(
    (s) => s.zoneId === zoneId
  );
  res.json(sensors);
});

// POST /buildings/:buildingId/zones/:zoneId/sensors
router.post('/', (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const { type, label } = req.body;

  if (!type || !VALID_TYPES.includes(type)) {
    res.status(400).json({
      error: 'validation_error',
      message: `Le champ type est requis et doit être parmi : ${VALID_TYPES.join(', ')}`,
    });
    return;
  }

  const sensor: Sensor = {
    id: uuidv4(),
    zoneId,
    type,
    status: 'active',
    label: label ?? `Capteur ${type}`,
  };

  store.sensors.set(sensor.id, sensor);
  res.status(201).json(sensor);
});

// GET /buildings/:buildingId/zones/:zoneId/sensors/:sensorId
router.get('/:sensorId', (req: Request<SensorParams>, res: Response) => {
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

  res.json(sensor);
});

// PATCH /buildings/:buildingId/zones/:zoneId/sensors/:sensorId
router.patch('/:sensorId', (req: Request<SensorParams>, res: Response) => {
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

  const { status } = req.body;
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({
      error: 'validation_error',
      message: `Le statut doit être parmi : ${VALID_STATUSES.join(', ')}`,
    });
    return;
  }

  const updated: Sensor = { ...sensor, ...req.body, id: sensor.id, zoneId: sensor.zoneId };
  store.sensors.set(sensor.id, updated);
  res.json(updated);
});

// DELETE /buildings/:buildingId/zones/:zoneId/sensors/:sensorId
router.delete('/:sensorId', (req: Request<SensorParams>, res: Response) => {
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

  store.measurements = store.measurements.filter((m) => m.sensorId !== sensorId);
  store.sensors.delete(sensorId);
  res.status(204).send();
});

export default router;
