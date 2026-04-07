import mongoose, { Schema, Document } from 'mongoose';

// ── Building ──────────────────────────────────────────────────────────────────
export interface IBuilding extends Document<string> {
  _id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

const BuildingSchema = new Schema<IBuilding>({
  _id:       { type: String, required: true },
  name:      { type: String, required: true },
  address:   { type: String, required: true },
  latitude:  { type: Number, required: true },
  longitude: { type: Number, required: true },
});

// ── Zone ──────────────────────────────────────────────────────────────────────
export interface IZone extends Document<string> {
  _id: string;
  buildingId: string;
  name: string;
}

const ZoneSchema = new Schema<IZone>({
  _id:        { type: String, required: true },
  buildingId: { type: String, required: true, ref: 'Building' },
  name:       { type: String, required: true },
});

// ── Sensor ────────────────────────────────────────────────────────────────────
export interface ISensor extends Document<string> {
  _id: string;
  zoneId: string;
  type: 'temperature' | 'humidity' | 'both';
  status: 'active' | 'faulty' | 'maintenance' | 'offline';
  label: string;
}

const SensorSchema = new Schema<ISensor>({
  _id:    { type: String, required: true },
  zoneId: { type: String, required: true, ref: 'Zone' },
  type:   { type: String, enum: ['temperature', 'humidity', 'both'], required: true },
  status: { type: String, enum: ['active', 'faulty', 'maintenance', 'offline'], default: 'active' },
  label:  { type: String, required: true },
});

// ── Measurement ───────────────────────────────────────────────────────────────
export interface IMeasurement extends Document<string> {
  _id: string;
  sensorId: string;
  type: 'temperature' | 'humidity';
  value: number;
  unit: string;
  timestamp: string;
}

const MeasurementSchema = new Schema<IMeasurement>({
  _id:       { type: String, required: true },
  sensorId:  { type: String, required: true, ref: 'Sensor' },
  type:      { type: String, enum: ['temperature', 'humidity'], required: true },
  value:     { type: Number, required: true },
  unit:      { type: String, required: true },
  timestamp: { type: String, required: true },
});

MeasurementSchema.index({ sensorId: 1, timestamp: -1 });

// ── Actuator ──────────────────────────────────────────────────────────────────
export interface IActuator extends Document<string> {
  _id: string;
  zoneId: string;
  type: 'heating' | 'cooling' | 'ventilation';
  status: 'on' | 'off' | 'auto' | 'maintenance';
  label: string;
}

const ActuatorSchema = new Schema<IActuator>({
  _id:    { type: String, required: true },
  zoneId: { type: String, required: true, ref: 'Zone' },
  type:   { type: String, enum: ['heating', 'cooling', 'ventilation'], required: true },
  status: { type: String, enum: ['on', 'off', 'auto', 'maintenance'], default: 'off' },
  label:  { type: String, required: true },
});

// ── User ──────────────────────────────────────────────────────────────────────
export interface IUser extends Document<string> {
  _id: string;
  username: string;
  role: 'admin' | 'operator' | 'device';
  zoneId?: string;
}

const UserSchema = new Schema<IUser>({
  _id:      { type: String, required: true },
  username: { type: String, required: true, unique: true },
  role:     { type: String, enum: ['admin', 'operator', 'device'], required: true },
  zoneId:   { type: String, ref: 'Zone' },
});

export const Building    = mongoose.model<IBuilding>('Building', BuildingSchema);
export const Zone        = mongoose.model<IZone>('Zone', ZoneSchema);
export const Sensor      = mongoose.model<ISensor>('Sensor', SensorSchema);
export const Measurement = mongoose.model<IMeasurement>('Measurement', MeasurementSchema);
export const Actuator    = mongoose.model<IActuator>('Actuator', ActuatorSchema);
export const User        = mongoose.model<IUser>('User', UserSchema);
