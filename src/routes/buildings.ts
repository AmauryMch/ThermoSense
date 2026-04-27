import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Building, Zone, Sensor, Measurement, Actuator } from '../db/models';
import { requireRole } from '../middleware/auth';

const router = Router();

// GET /buildings
// BFLA: admin + operator
router.get('/', requireRole('admin', 'operator'), async (_req: Request, res: Response) => {
  const buildings = await Building.find();
  res.json(buildings);
});

// POST /buildings
// BFLA: admin + operator
router.post('/', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  const { name, address, latitude, longitude } = req.body;
  if (!name || !address || latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: 'validation_error', message: 'Les champs name, address, latitude et longitude sont requis' });
    return;
  }
  const building = await Building.create({ _id: uuidv4(), name, address, latitude: Number(latitude), longitude: Number(longitude) });
  res.status(201).json(building);
});

// GET /buildings/:buildingId
// BFLA: admin + operator
router.get('/:buildingId', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  const building = await Building.findById(req.params.buildingId);
  if (!building) { res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' }); return; }
  res.json(building);
});

// PATCH /buildings/:buildingId
// BFLA: admin + operator
router.patch('/:buildingId', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  const building = await Building.findByIdAndUpdate(req.params.buildingId, req.body, { new: true });
  if (!building) { res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' }); return; }
  res.json(building);
});

// DELETE /buildings/:buildingId
// BFLA: admin uniquement (suppression en cascade irréversible)
router.delete('/:buildingId', requireRole('admin'), async (req: Request, res: Response) => {
  const building = await Building.findByIdAndDelete(req.params.buildingId);
  if (!building) { res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' }); return; }

  const zones = await Zone.find({ buildingId: req.params.buildingId });
  const zoneIds = zones.map((z) => z._id);
  const sensors = await Sensor.find({ zoneId: { $in: zoneIds } });
  const sensorIds = sensors.map((s) => s._id);

  await Measurement.deleteMany({ sensorId: { $in: sensorIds } });
  await Sensor.deleteMany({ zoneId: { $in: zoneIds } });
  await Actuator.deleteMany({ zoneId: { $in: zoneIds } });
  await Zone.deleteMany({ buildingId: req.params.buildingId });

  res.status(204).send();
});

export default router;
