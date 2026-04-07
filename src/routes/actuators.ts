import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../data/store';
import { Actuator, ActuatorType, ActuatorStatus } from '../types';

const router = Router({ mergeParams: true });

interface ZoneParams { buildingId: string; zoneId: string }
interface ActuatorParams { buildingId: string; zoneId: string; actuatorId: string }

const VALID_TYPES: ActuatorType[] = ['heating', 'cooling', 'ventilation'];
const VALID_STATUSES: ActuatorStatus[] = ['on', 'off', 'auto', 'maintenance'];
const VALID_ACTIONS = ['on', 'off', 'auto'] as const;
type Action = typeof VALID_ACTIONS[number];

// GET /buildings/:buildingId/zones/:zoneId/actuators
router.get('/', (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const actuators = Array.from(store.actuators.values()).filter(
    (a) => a.zoneId === zoneId
  );
  res.json(actuators);
});

// POST /buildings/:buildingId/zones/:zoneId/actuators
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

  const actuator: Actuator = {
    id: uuidv4(),
    zoneId,
    type,
    status: 'off',
    label: label ?? `Actionneur ${type}`,
  };

  store.actuators.set(actuator.id, actuator);
  res.status(201).json(actuator);
});

// GET /buildings/:buildingId/zones/:zoneId/actuators/:actuatorId
router.get('/:actuatorId', (req: Request<ActuatorParams>, res: Response) => {
  const { buildingId, zoneId, actuatorId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const actuator = store.actuators.get(actuatorId);
  if (!actuator || actuator.zoneId !== zoneId) {
    res.status(404).json({ error: 'not_found', message: 'Actionneur introuvable' });
    return;
  }

  res.json(actuator);
});

// POST /buildings/:buildingId/zones/:zoneId/actuators/:actuatorId/commands
router.post('/:actuatorId/commands', (req: Request<ActuatorParams>, res: Response) => {
  const { buildingId, zoneId, actuatorId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const actuator = store.actuators.get(actuatorId);
  if (!actuator || actuator.zoneId !== zoneId) {
    res.status(404).json({ error: 'not_found', message: 'Actionneur introuvable' });
    return;
  }

  if (actuator.status === 'maintenance') {
    res.status(503).json({
      error: 'device_unavailable',
      message: `L'actionneur ${actuatorId} est en maintenance`,
      actuator_id: actuatorId,
      retry_after: 3600,
    });
    return;
  }

  const { action } = req.body;
  if (!action || !VALID_ACTIONS.includes(action as Action)) {
    res.status(400).json({
      error: 'validation_error',
      message: `Le champ action est requis et doit être parmi : ${VALID_ACTIONS.join(', ')}`,
    });
    return;
  }

  const previousStatus = actuator.status;
  const newStatus = action as ActuatorStatus;

  // Idempotence : déjà dans l'état demandé
  if (previousStatus === newStatus) {
    res.json({
      command_id: uuidv4(),
      actuator_id: actuatorId,
      action,
      status: 'no_change',
      previous_state: previousStatus,
      current_state: newStatus,
      executed_at: new Date().toISOString(),
    });
    return;
  }

  const updated: Actuator = { ...actuator, status: newStatus };
  store.actuators.set(actuatorId, updated);

  res.status(200).json({
    command_id: uuidv4(),
    actuator_id: actuatorId,
    action,
    status: 'executed',
    previous_state: previousStatus,
    current_state: newStatus,
    executed_at: new Date().toISOString(),
  });
});

// PATCH /buildings/:buildingId/zones/:zoneId/actuators/:actuatorId
router.patch('/:actuatorId', (req: Request<ActuatorParams>, res: Response) => {
  const { buildingId, zoneId, actuatorId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const actuator = store.actuators.get(actuatorId);
  if (!actuator || actuator.zoneId !== zoneId) {
    res.status(404).json({ error: 'not_found', message: 'Actionneur introuvable' });
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

  const updated: Actuator = { ...actuator, ...req.body, id: actuator.id, zoneId: actuator.zoneId };
  store.actuators.set(actuator.id, updated);
  res.json(updated);
});

// DELETE /buildings/:buildingId/zones/:zoneId/actuators/:actuatorId
router.delete('/:actuatorId', (req: Request<ActuatorParams>, res: Response) => {
  const { buildingId, zoneId, actuatorId } = req.params;

  const zone = store.zones.get(zoneId);
  if (!zone || zone.buildingId !== buildingId) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' });
    return;
  }

  const actuator = store.actuators.get(actuatorId);
  if (!actuator || actuator.zoneId !== zoneId) {
    res.status(404).json({ error: 'not_found', message: 'Actionneur introuvable' });
    return;
  }

  store.actuators.delete(actuatorId);
  res.status(204).send();
});

export default router;
