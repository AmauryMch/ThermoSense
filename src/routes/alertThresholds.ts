import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../data/store';
import { AlertThreshold } from '../types';

const router = Router({ mergeParams: true });

interface AlertThresholdParams {
  buildingId: string;
  zoneId: string;
  thresholdId?: string;
}

// GET /buildings/:buildingId/zones/:zoneId/alert-thresholds
router.get('/', (req: Request<AlertThresholdParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;

  if (!store.buildings.has(buildingId) || !store.zones.has(zoneId)) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Bâtiment ou zone inexistant' });
    return;
  }

  const thresholds = Array.from(store.alertThresholds.values()).filter(
    (t) => t.zoneId === zoneId,
  );
  res.json({ data: thresholds });
});

// POST /buildings/:buildingId/zones/:zoneId/alert-thresholds
router.post('/', (req: Request<AlertThresholdParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;
  const { measurementType, operator, value, durationSeconds, enabled = true } = req.body;

  if (!store.buildings.has(buildingId) || !store.zones.has(zoneId)) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Bâtiment ou zone inexistant' });
    return;
  }

  // Validation
  if (!measurementType || !['temperature', 'humidity'].includes(measurementType)) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'measurementType doit être "temperature" ou "humidity"',
    });
    return;
  }

  if (!operator || !['gt', 'gte', 'lt', 'lte', 'eq'].includes(operator)) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'operator invalide (gt, gte, lt, lte, eq)',
    });
    return;
  }

  if (value === undefined || typeof value !== 'number') {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'value est requis et doit être un nombre',
    });
    return;
  }

  if (!durationSeconds || durationSeconds < 1) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'durationSeconds est requis et doit être >= 1',
    });
    return;
  }

  const now = new Date().toISOString();
  const threshold: AlertThreshold = {
    id: uuidv4(),
    zoneId,
    measurementType,
    operator,
    value,
    durationSeconds,
    enabled,
    versionTag: now,
    createdAt: now,
  };

  store.alertThresholds.set(threshold.id, threshold);
  res.status(201).json(threshold);
});

// GET /buildings/:buildingId/zones/:zoneId/alert-thresholds/:thresholdId
router.get('/:thresholdId', (req: Request<AlertThresholdParams>, res: Response) => {
  const { buildingId, zoneId, thresholdId } = req.params;

  if (!store.buildings.has(buildingId) || !store.zones.has(zoneId)) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Bâtiment ou zone inexistant' });
    return;
  }

  const threshold = store.alertThresholds.get(thresholdId!);
  if (!threshold || threshold.zoneId !== zoneId) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Seuil d\'alerte inexistant' });
    return;
  }

  res.json(threshold);
});

// PATCH /buildings/:buildingId/zones/:zoneId/alert-thresholds/:thresholdId
router.patch('/:thresholdId', (req: Request<AlertThresholdParams>, res: Response) => {
  const { buildingId, zoneId, thresholdId } = req.params;
  const { operator, value, durationSeconds, enabled, versionTag } = req.body;

  if (!store.buildings.has(buildingId) || !store.zones.has(zoneId)) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Bâtiment ou zone inexistant' });
    return;
  }

  const threshold = store.alertThresholds.get(thresholdId!);
  if (!threshold || threshold.zoneId !== zoneId) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Seuil d\'alerte inexistant' });
    return;
  }

  // C4: Optimistic locking
  if (versionTag && versionTag !== threshold.versionTag) {
    res.status(409).json({
      code: 'VERSION_CONFLICT',
      message: 'Le seuil a été modifié par ailleurs',
      details: { currentVersion: threshold.versionTag },
    });
    return;
  }

  // Validation des champs optionnels
  if (operator && !['gt', 'gte', 'lt', 'lte', 'eq'].includes(operator)) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'operator invalide',
    });
    return;
  }

  if (durationSeconds !== undefined && durationSeconds < 1) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'durationSeconds doit être >= 1',
    });
    return;
  }

  const now = new Date().toISOString();
  const updated: AlertThreshold = {
    ...threshold,
    operator: operator !== undefined ? operator : threshold.operator,
    value: value !== undefined ? value : threshold.value,
    durationSeconds: durationSeconds !== undefined ? durationSeconds : threshold.durationSeconds,
    enabled: enabled !== undefined ? enabled : threshold.enabled,
    versionTag: now,
  };

  store.alertThresholds.set(threshold.id, updated);
  res.json(updated);
});

// DELETE /buildings/:buildingId/zones/:zoneId/alert-thresholds/:thresholdId
router.delete('/:thresholdId', (req: Request<AlertThresholdParams>, res: Response) => {
  const { buildingId, zoneId, thresholdId } = req.params;

  if (!store.buildings.has(buildingId) || !store.zones.has(zoneId)) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Bâtiment ou zone inexistant' });
    return;
  }

  const threshold = store.alertThresholds.get(thresholdId!);
  if (!threshold || threshold.zoneId !== zoneId) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Seuil d\'alerte inexistant' });
    return;
  }

  // Supprimer les alertes associées
  store.alertEvents = store.alertEvents.filter((e) => e.thresholdId !== thresholdId);

  // Supprimer le seuil
  store.alertThresholds.delete(thresholdId!);

  res.status(204).send();
});

export default router;
