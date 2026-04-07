import { Building, Zone, Sensor, Measurement, Actuator, User } from '../types';

// Store global en mémoire — remplace une vraie base de données pour S3→S4
export const store: {
  buildings: Map<string, Building>;
  zones: Map<string, Zone>;
  sensors: Map<string, Sensor>;
  measurements: Measurement[];
  actuators: Map<string, Actuator>;
  users: Map<string, User>;
} = {
  buildings: new Map(),
  zones: new Map(),
  sensors: new Map(),
  measurements: [],
  actuators: new Map(),
  users: new Map(),
};
