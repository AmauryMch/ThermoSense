import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../data/store';
import { Building } from '../types';

const router = Router();

interface BuildingParams { buildingId: string }

// GET /buildings
router.get('/', (_req: Request, res: Response) => {
  res.json(Array.from(store.buildings.values()));
});

// POST /buildings
router.post('/', (req: Request, res: Response) => {
  const { name, address, latitude, longitude } = req.body;

  if (!name || !address || latitude === undefined || longitude === undefined) {
    res.status(400).json({
      error: 'validation_error',
      message: 'Les champs name, address, latitude et longitude sont requis',
    });
    return;
  }

  const building: Building = {
    id: uuidv4(),
    name,
    address,
    latitude: Number(latitude),
    longitude: Number(longitude),
  };

  store.buildings.set(building.id, building);
  res.status(201).json(building);
});

// GET /buildings/:buildingId
router.get('/:buildingId', (req: Request<BuildingParams>, res: Response) => {
  const { buildingId } = req.params;
  const building = store.buildings.get(buildingId);
  if (!building) {
    res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' });
    return;
  }
  res.json(building);
});

// PATCH /buildings/:buildingId
router.patch('/:buildingId', (req: Request<BuildingParams>, res: Response) => {
  const { buildingId } = req.params;
  const building = store.buildings.get(buildingId);
  if (!building) {
    res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' });
    return;
  }

  const updated: Building = { ...building, ...req.body, id: building.id };
  store.buildings.set(building.id, updated);
  res.json(updated);
});

// DELETE /buildings/:buildingId
router.delete('/:buildingId', (req: Request<BuildingParams>, res: Response) => {
  const { buildingId } = req.params;
  const building = store.buildings.get(buildingId);
  if (!building) {
    res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' });
    return;
  }

  // Suppression en cascade : zones → capteurs/actionneurs → mesures
  const zoneIds = Array.from(store.zones.values())
    .filter((z) => z.buildingId === building.id)
    .map((z) => z.id);

  const sensorIds = Array.from(store.sensors.values())
    .filter((s) => zoneIds.includes(s.zoneId))
    .map((s) => s.id);

  store.measurements = store.measurements.filter(
    (m) => !sensorIds.includes(m.sensorId)
  );
  sensorIds.forEach((id) => store.sensors.delete(id));

  Array.from(store.actuators.values())
    .filter((a) => zoneIds.includes(a.zoneId))
    .forEach((a) => store.actuators.delete(a.id));

  zoneIds.forEach((id) => store.zones.delete(id));
  store.buildings.delete(building.id);

  res.status(204).send();
});

export default router;
