import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Zone, Actuator } from '../db/models';

const router = Router({ mergeParams: true });

interface ZoneParams { buildingId: string; zoneId: string }
interface ActuatorParams { buildingId: string; zoneId: string; actuatorId: string }

const VALID_TYPES = ['heating', 'cooling', 'ventilation'];
const VALID_STATUSES = ['on', 'off', 'auto', 'maintenance'];
const VALID_ACTIONS = ['on', 'off', 'auto'];

async function findZone(buildingId: string, zoneId: string) {
  return Zone.findOne({ _id: zoneId, buildingId });
}

// GET /buildings/:buildingId/zones/:zoneId/actuators
router.get('/', async (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  res.json(await Actuator.find({ zoneId }));
});

// POST /buildings/:buildingId/zones/:zoneId/actuators
router.post('/', async (req: Request<ZoneParams>, res: Response) => {
  const { buildingId, zoneId } = req.params;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const { type, label } = req.body;
  if (!type || !VALID_TYPES.includes(type)) {
    res.status(400).json({ error: 'validation_error', message: `type doit être parmi : ${VALID_TYPES.join(', ')}` }); return;
  }
  const actuator = await Actuator.create({ _id: uuidv4(), zoneId, type, status: 'off', label: label ?? `Actionneur ${type}` });
  res.status(201).json(actuator);
});

// GET /buildings/:buildingId/zones/:zoneId/actuators/:actuatorId
router.get('/:actuatorId', async (req: Request<ActuatorParams>, res: Response) => {
  const { buildingId, zoneId, actuatorId } = req.params;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const actuator = await Actuator.findOne({ _id: actuatorId, zoneId });
  if (!actuator) { res.status(404).json({ error: 'not_found', message: 'Actionneur introuvable' }); return; }
  res.json(actuator);
});

// POST /buildings/:buildingId/zones/:zoneId/actuators/:actuatorId/commands
router.post('/:actuatorId/commands', async (req: Request<ActuatorParams>, res: Response) => {
  const { buildingId, zoneId, actuatorId } = req.params;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const actuator = await Actuator.findOne({ _id: actuatorId, zoneId });
  if (!actuator) { res.status(404).json({ error: 'not_found', message: 'Actionneur introuvable' }); return; }

  if (actuator.status === 'maintenance') {
    res.status(503).json({ error: 'device_unavailable', message: `L'actionneur ${actuatorId} est en maintenance`, actuator_id: actuatorId, retry_after: 3600 });
    return;
  }

  const { action } = req.body;
  if (!action || !VALID_ACTIONS.includes(action)) {
    res.status(400).json({ error: 'validation_error', message: `action doit être parmi : ${VALID_ACTIONS.join(', ')}` }); return;
  }

  const previousStatus = actuator.status;

  // Idempotence
  if (previousStatus === action) {
    res.json({ command_id: uuidv4(), actuator_id: actuatorId, action, status: 'no_change', previous_state: previousStatus, current_state: action, executed_at: new Date().toISOString() });
    return;
  }

  await Actuator.findByIdAndUpdate(actuatorId, { status: action });

  res.json({ command_id: uuidv4(), actuator_id: actuatorId, action, status: 'executed', previous_state: previousStatus, current_state: action, executed_at: new Date().toISOString() });
});

// PATCH /buildings/:buildingId/zones/:zoneId/actuators/:actuatorId
router.patch('/:actuatorId', async (req: Request<ActuatorParams>, res: Response) => {
  const { buildingId, zoneId, actuatorId } = req.params;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const { status } = req.body;
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'validation_error', message: `status doit être parmi : ${VALID_STATUSES.join(', ')}` }); return;
  }
  const actuator = await Actuator.findOneAndUpdate({ _id: actuatorId, zoneId }, req.body, { new: true });
  if (!actuator) { res.status(404).json({ error: 'not_found', message: 'Actionneur introuvable' }); return; }
  res.json(actuator);
});

// DELETE /buildings/:buildingId/zones/:zoneId/actuators/:actuatorId
router.delete('/:actuatorId', async (req: Request<ActuatorParams>, res: Response) => {
  const { buildingId, zoneId, actuatorId } = req.params;
  if (!(await findZone(buildingId, zoneId))) {
    res.status(404).json({ error: 'not_found', message: 'Zone introuvable' }); return;
  }
  const actuator = await Actuator.findOneAndDelete({ _id: actuatorId, zoneId });
  if (!actuator) { res.status(404).json({ error: 'not_found', message: 'Actionneur introuvable' }); return; }
  res.status(204).send();
});

export default router;
