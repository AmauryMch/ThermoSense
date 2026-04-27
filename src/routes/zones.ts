import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Building, Zone, Sensor, Measurement, Actuator } from '../db/models';
import { requireRole, requireZoneAccess } from '../middleware/auth';

const router = Router({ mergeParams: true });

interface BuildingP { buildingId: string }
interface ZoneP { buildingId: string; zoneId: string }

// GET /buildings/:buildingId/zones
// BFLA: admin uniquement (liste globale des zones)
router.get('/', requireRole('admin'), async (req: Request, res: Response) => {
  const { buildingId } = req.params as unknown as BuildingP;
  if (!(await Building.exists({ _id: buildingId }))) {
    res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' }); return;
  }
  res.json(await Zone.find({ buildingId }));
});

// POST /buildings/:buildingId/zones
// BFLA: admin uniquement
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  const { buildingId } = req.params as unknown as BuildingP;
  if (!(await Building.exists({ _id: buildingId }))) {
    res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' }); return;
  }
  if (!req.body.name) {
    res.status(400).json({ error: 'validation_error', message: 'Le champ name est requis' }); return;
  }
  const zone = await Zone.create({ _id: uuidv4(), buildingId, name: req.body.name });
  res.status(201).json(zone);
});

// GET /buildings/:buildingId/zones/:zoneId
// BFLA: admin + operator | BOLA: sa zone uniquement
router.get('/:zoneId', requireRole('admin', 'operator'), requireZoneAccess, async (req: Request, res: Response) => {
  const { buildingId, zoneId } = req.params as unknown as ZoneP;
  const zone = await Zone.findOne({ _id: zoneId, buildingId });
  if (!zone) { res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return; }
  res.json(zone);
});

// PATCH /buildings/:buildingId/zones/:zoneId
// BFLA: admin uniquement
router.patch('/:zoneId', requireRole('admin'), async (req: Request, res: Response) => {
  const { buildingId, zoneId } = req.params as unknown as ZoneP;
  const zone = await Zone.findOneAndUpdate({ _id: zoneId, buildingId }, { name: req.body.name }, { new: true });
  if (!zone) { res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return; }
  res.json(zone);
});

// DELETE /buildings/:buildingId/zones/:zoneId
// BFLA: admin uniquement (suppression en cascade irréversible)
router.delete('/:zoneId', requireRole('admin'), async (req: Request, res: Response) => {
  const { buildingId, zoneId } = req.params as unknown as ZoneP;
  const zone = await Zone.findOneAndDelete({ _id: zoneId, buildingId });
  if (!zone) { res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return; }

  const sensors = await Sensor.find({ zoneId });
  const sensorIds = sensors.map((s) => s._id);
  await Measurement.deleteMany({ sensorId: { $in: sensorIds } });
  await Sensor.deleteMany({ zoneId });
  await Actuator.deleteMany({ zoneId });

  res.status(204).send();
});

export default router;
