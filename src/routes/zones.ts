import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../data/store';
import { Zone } from '../types';

const router = Router({ mergeParams: true });

interface ZoneParams { buildingId: string; zoneId: string }
interface BuildingParams { buildingId: string }

// GET /buildings/:buildingId/zones
router.get('/', (req: Request<BuildingParams>, res: Response) => {
  const { buildingId } = req.params;

  if (!store.buildings.has(buildingId)) {
    res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' });
    return;
  }

  const zones = Array.from(store.zones.values()).filter(
    (z) => z.buildingId === buildingId
  );
  res.json(zones);
});

// POST /buildings/:buildingId/zones
router.post('/', (req: Request<BuildingParams>, res: Response) => {
  const { buildingId } = req.params;

  if (!store.buildings.has(buildingId)) {
    res.status(404).json({ error: 'not_found', message: 'Bâtiment introuvable' });
    return;
  }

  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'validation_error', message: 'Le champ name est requis' });
    return;
  }

  const zone: Zone = { id: uuidv4(), buildingId, name };
  store.zones.set(zone.id, zone);
  res.status(201).json(zone);
});

// GET /buildings/:buildingId/zones/:zoneId
router.get('/:zoneId', (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }
  res.json(zone);
});

// PATCH /buildings/:buildingId/zones/:zoneId
router.patch('/:zoneId', (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const updated: Zone = { ...zone, ...req.body, id: zone.id, buildingId: zone.buildingId };
  store.zones.set(zone.id, updated);
  res.json(updated);
});

// DELETE /buildings/:buildingId/zones/:zoneId
router.delete('/:zoneId', (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  // Suppression en cascade
  const sensorIds = Array.from(store.sensors.values())
    .filter((s) => s.zoneId === zoneId)
    .map((s) => s.id);

  store.measurements = store.measurements.filter(
    (m) => !sensorIds.includes(m.sensorId)
  );
  sensorIds.forEach((id) => store.sensors.delete(id));

  Array.from(store.actuators.values())
    .filter((a) => a.zoneId === zoneId)
    .forEach((a) => store.actuators.delete(a.id));

  store.zones.delete(zoneId);
  res.status(204).send();
});

export default router;
