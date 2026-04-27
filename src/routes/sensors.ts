import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Zone, Sensor } from '../db/models';
import { requireRole, requireZoneAccess } from '../middleware/auth';

const router = Router({ mergeParams: true });

interface ZoneP { buildingId: string; zoneId: string }
interface SensorP { buildingId: string; zoneId: string; sensorId: string }

const VALID_TYPES = ['temperature', 'humidity', 'both'];
const VALID_STATUSES = ['active', 'faulty', 'maintenance', 'offline'];

async function findZone(buildingId: string, zoneId: string) {
  return Zone.findOne({ _id: zoneId, buildingId });
}

// GET /buildings/:buildingId/zones/:zoneId/sensors
// BFLA: admin + operator | BOLA: sa zone uniquement
router.get('/', requireRole('admin', 'operator'), requireZoneAccess, async (req: Request, res: Response) => {
  const { buildingId, zoneId } = req.params as unknown as ZoneP;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  res.json(await Sensor.find({ zoneId }));
});

// POST /buildings/:buildingId/zones/:zoneId/sensors
// BFLA: admin + operator | BOLA: sa zone uniquement
router.post('/', requireRole('admin', 'operator'), requireZoneAccess, async (req: Request, res: Response) => {
  const { buildingId, zoneId } = req.params as unknown as ZoneP;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const { type, label } = req.body;
  if (!type || !VALID_TYPES.includes(type)) {
    res.status(400).json({ error: 'validation_error', message: `type doit être parmi : ${VALID_TYPES.join(', ')}` }); return;
  }
  const sensor = await Sensor.create({ _id: uuidv4(), zoneId, type, status: 'active', label: label ?? `Capteur ${type}` });
  res.status(201).json(sensor);
});

// GET /buildings/:buildingId/zones/:zoneId/sensors/:sensorId
// BOLA: sa zone uniquement (tous les rôles authentifiés)
router.get('/:sensorId', requireZoneAccess, async (req: Request, res: Response) => {
  const { buildingId, zoneId, sensorId } = req.params as unknown as SensorP;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const sensor = await Sensor.findOne({ _id: sensorId, zoneId });
  if (!sensor) { res.status(404).json({ error: 'not_found', message: 'Capteur introuvable' }); return; }
  res.json(sensor);
});

// PATCH /buildings/:buildingId/zones/:zoneId/sensors/:sensorId
// BFLA: admin + operator | BOLA: sa zone uniquement
router.patch('/:sensorId', requireRole('admin', 'operator'), requireZoneAccess, async (req: Request, res: Response) => {
  const { buildingId, zoneId, sensorId } = req.params as unknown as SensorP;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const { status } = req.body;
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'validation_error', message: `status doit être parmi : ${VALID_STATUSES.join(', ')}` }); return;
  }
  const sensor = await Sensor.findOneAndUpdate({ _id: sensorId, zoneId }, req.body, { new: true });
  if (!sensor) { res.status(404).json({ error: 'not_found', message: 'Capteur introuvable' }); return; }
  res.json(sensor);
});

// DELETE /buildings/:buildingId/zones/:zoneId/sensors/:sensorId
// BFLA: admin + operator | BOLA: sa zone uniquement
router.delete('/:sensorId', requireRole('admin', 'operator'), requireZoneAccess, async (req: Request, res: Response) => {
  const { buildingId, zoneId, sensorId } = req.params as unknown as SensorP;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const sensor = await Sensor.findOneAndDelete({ _id: sensorId, zoneId });
  if (!sensor) { res.status(404).json({ error: 'not_found', message: 'Capteur introuvable' }); return; }
  res.status(204).send();
});

export default router;
