// ── Buildings ────────────────────────────────────────────────────────────────
export interface Building {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// ── Zones ─────────────────────────────────────────────────────────────────────
export interface Zone {
  id: string;
  buildingId: string;
  name: string;
}

// ── Sensors ───────────────────────────────────────────────────────────────────
export type SensorType = 'temperature' | 'humidity' | 'both';
export type SensorStatus = 'active' | 'faulty' | 'maintenance' | 'offline';

export interface Sensor {
  id: string;
  zoneId: string;
  type: SensorType;
  status: SensorStatus;
  label: string;
}

// ── Measurements ──────────────────────────────────────────────────────────────
export type MeasurementType = 'temperature' | 'humidity';

export interface Measurement {
  id: string;
  sensorId: string;
  type: MeasurementType;
  value: number;
  unit: string;
  timestamp: string;
}

// ── Actuators ─────────────────────────────────────────────────────────────────
export type ActuatorType = 'heating' | 'cooling' | 'ventilation';
export type ActuatorStatus = 'on' | 'off' | 'auto' | 'maintenance';

export interface Actuator {
  id: string;
  zoneId: string;
  type: ActuatorType;
  status: ActuatorStatus;
  label: string;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'operator' | 'device';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  zoneId?: string; // pour les opérateurs restreints à une zone
}
