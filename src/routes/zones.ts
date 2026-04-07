import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Building, Zone, Sensor, Measurement, Actuator } from '../db/models';

const router = Router({ mergeParams: true });

interface BuildingParams { buildingId: string }
interface ZoneParams { buildingId: string; zoneId: string }

// GET /buildings/:buildingId/zones
router.get('/', async (req: Request<BuildingParams>, res: Response) => {
  const { buildingId } = req.params;
  if (!(await Building.exists({ _id: buildingId }))) {
    res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' }); return;
  }
  res.json(await Zone.find({ buildingId }));
});

// POST /buildings/:buildingId/zones
router.post('/', async (req: Request<BuildingParams>, res: Response) => {
  const { buildingId } = req.params;
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
router.get('/:zoneId', async (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;
  const zone = await Zone.findOne({ _id: zoneId, buildingId });
  if (!zone) { res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return; }
  res.json(zone);
});

// PATCH /buildings/:buildingId/zones/:zoneId
router.patch('/:zoneId', async (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;
  const zone = await Zone.findOneAndUpdate({ _id: zoneId, buildingId }, { name: req.body.name }, { new: true });
  if (!zone) { res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return; }
  res.json(zone);
});

// DELETE /buildings/:buildingId/zones/:zoneId
router.delete('/:zoneId', async (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;
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
