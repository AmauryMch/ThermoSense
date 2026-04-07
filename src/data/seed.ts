import bcrypt from 'bcryptjs';
import { Building, Zone, Sensor, Measurement, Actuator, User } from '../db/models';

function recentTimestamp(offsetMinutes: number): string {
  return new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString();
}

function jitter(base: number, range: number): number {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
}

export async function seedDatabase(): Promise<void> {
  // Ne seed que si la base est vide
  const existingCount = await Building.countDocuments();
  if (existingCount > 0) {
    console.log('[seed] Base déjà peuplée, seed ignoré');
    return;
  }

  // ── Buildings ──────────────────────────────────────────────────────────────
  await Building.insertMany([
    { _id: 'b-001', name: 'Siège Social ThermoSense', address: '12 rue de la Paix, 75001 Paris',      latitude: 48.8698, longitude: 2.3307 },
    { _id: 'b-002', name: 'Entrepôt Logistique Nord',  address: '5 avenue Industrielle, 59000 Lille', latitude: 50.6292, longitude: 3.0573 },
  ]);

  // ── Zones ──────────────────────────────────────────────────────────────────
  await Zone.insertMany([
    { _id: 'z-001', buildingId: 'b-001', name: 'Zone A — Open Space' },
    { _id: 'z-002', buildingId: 'b-001', name: 'Zone B — Salle Serveurs' },
    { _id: 'z-003', buildingId: 'b-002', name: 'Zone C — Entrepôt' },
  ]);

  // ── Sensors ────────────────────────────────────────────────────────────────
  const sensorsData = [
    { _id: 's-001', zoneId: 'z-001', type: 'temperature', status: 'active',      label: 'Capteur temp A-1' },
    { _id: 's-002', zoneId: 'z-001', type: 'humidity',    status: 'active',      label: 'Capteur hum A-2' },
    { _id: 's-003', zoneId: 'z-001', type: 'both',        status: 'active',      label: 'Capteur mixte A-3' },
    { _id: 's-004', zoneId: 'z-001', type: 'temperature', status: 'offline',     label: 'Capteur temp A-4 (hors ligne)' },
    { _id: 's-005', zoneId: 'z-002', type: 'temperature', status: 'active',      label: 'Capteur temp B-1' },
    { _id: 's-006', zoneId: 'z-002', type: 'temperature', status: 'active',      label: 'Capteur temp B-2' },
    { _id: 's-007', zoneId: 'z-002', type: 'humidity',    status: 'faulty',      label: 'Capteur hum B-3 (défaillant)' },
    { _id: 's-008', zoneId: 'z-003', type: 'both',        status: 'active',      label: 'Capteur mixte C-1' },
    { _id: 's-009', zoneId: 'z-003', type: 'temperature', status: 'maintenance', label: 'Capteur temp C-2 (maintenance)' },
  ];
  await Sensor.insertMany(sensorsData);

  // ── Actuators ──────────────────────────────────────────────────────────────
  await Actuator.insertMany([
    { _id: 'a-001', zoneId: 'z-001', type: 'heating',     status: 'auto',        label: 'Chauffage A-1' },
    { _id: 'a-002', zoneId: 'z-001', type: 'ventilation', status: 'on',          label: 'Ventilation A-2' },
    { _id: 'a-003', zoneId: 'z-002', type: 'cooling',     status: 'on',          label: 'Climatisation B-1' },
    { _id: 'a-004', zoneId: 'z-002', type: 'ventilation', status: 'maintenance', label: 'Ventilation B-2 (maintenance)' },
    { _id: 'a-005', zoneId: 'z-003', type: 'heating',     status: 'off',         label: 'Chauffage C-1' },
  ]);

  // ── Measurements (historique 24h) ──────────────────────────────────────────
  const baselines: Record<string, { temp: number; hum: number }> = {
    'z-001': { temp: 21.5, hum: 45 },
    'z-002': { temp: 18.0, hum: 30 },
    'z-003': { temp: 14.0, hum: 60 },
  };

  const measurements = [];
  let idx = 1;
  const activeSensors = sensorsData.filter((s) => s.status === 'active');

  for (const sensor of activeSensors) {
    const base = baselines[sensor.zoneId] ?? { temp: 20, hum: 50 };
    const steps = 8;

    for (let i = steps; i >= 0; i--) {
      const offsetMin = i * (24 * 60 / steps);

      if (sensor.type === 'temperature' || sensor.type === 'both') {
        measurements.push({
          _id: `m-${String(idx++).padStart(4, '0')}`,
          sensorId: sensor._id,
          type: 'temperature',
          value: jitter(base.temp, 3),
          unit: '°C',
          timestamp: recentTimestamp(offsetMin),
        });
      }
      if (sensor.type === 'humidity' || sensor.type === 'both') {
        measurements.push({
          _id: `m-${String(idx++).padStart(4, '0')}`,
          sensorId: sensor._id,
          type: 'humidity',
          value: Math.min(100, Math.max(0, jitter(base.hum, 10))),
          unit: '%',
          timestamp: recentTimestamp(offsetMin),
        });
      }
    }
  }

  // Valeur aberrante pour réalisme
  measurements.push({
    _id: `m-${String(idx++).padStart(4, '0')}`,
    sensorId: 's-001',
    type: 'temperature',
    value: 38.5,
    unit: '°C',
    timestamp: recentTimestamp(15),
  });

  await Measurement.insertMany(measurements);

  // ── Users ──────────────────────────────────────────────────────────────────
  const [h1, h2, h3, h4, h5] = await Promise.all([
    bcrypt.hash('Admin1234!',    10),
    bcrypt.hash('Operator1234!', 10),
    bcrypt.hash('Operator1234!', 10),
    bcrypt.hash('Device1234!',   10),
    bcrypt.hash('Device1234!',   10),
  ]);
  await User.insertMany([
    { _id: 'u-001', username: 'admin',               passwordHash: h1, role: 'admin' },
    { _id: 'u-002', username: 'operator_zone_a',     passwordHash: h2, role: 'operator', zoneId: 'z-001' },
    { _id: 'u-003', username: 'operator_zone_b',     passwordHash: h3, role: 'operator', zoneId: 'z-002' },
    { _id: 'u-004', username: 'device_sensor_01',    passwordHash: h4, role: 'device' },
    { _id: 'u-005', username: 'device_actuator_01',  passwordHash: h5, role: 'device' },
  ]);

  console.log(
    `[seed] ${await Building.countDocuments()} bâtiments, ${await Zone.countDocuments()} zones, ` +
    `${await Sensor.countDocuments()} capteurs, ${await Actuator.countDocuments()} actionneurs, ` +
    `${await Measurement.countDocuments()} mesures, ${await User.countDocuments()} utilisateurs`
  );
}

// Upsert les mots de passe pour les utilisateurs qui n'en ont pas encore
// (utile quand la BD est déjà peuplée sans passwordHash)
export async function ensureUserPasswords(): Promise<void> {
  const defaults: { username: string; password: string }[] = [
    { username: 'admin',              password: 'Admin1234!' },
    { username: 'operator_zone_a',    password: 'Operator1234!' },
    { username: 'operator_zone_b',    password: 'Operator1234!' },
    { username: 'device_sensor_01',   password: 'Device1234!' },
    { username: 'device_actuator_01', password: 'Device1234!' },
  ];

  for (const { username, password } of defaults) {
    const user = await User.findOne({ username });
    if (user && !user.passwordHash) {
      user.passwordHash = await bcrypt.hash(password, 10);
      await user.save();
      console.log(`[seed] mot de passe initialisé pour ${username}`);
    }
  }
}
