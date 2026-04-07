import { store } from './store';
import { Building, Zone, Sensor, Measurement, Actuator, User } from '../types';

// Génère un timestamp dans les dernières 24h
function recentTimestamp(offsetMinutes: number): string {
  const d = new Date(Date.now() - offsetMinutes * 60 * 1000);
  return d.toISOString();
}

// Valeur réaliste avec légère variation aléatoire
function jitter(base: number, range: number): number {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
}

export function seedDatabase(): void {
  // ── Buildings ──────────────────────────────────────────────────────────────
  const buildings: Building[] = [
    {
      id: 'b-001',
      name: 'Siège Social ThermoSense',
      address: '12 rue de la Paix, 75001 Paris',
      latitude: 48.8698,
      longitude: 2.3307,
    },
    {
      id: 'b-002',
      name: 'Entrepôt Logistique Nord',
      address: '5 avenue Industrielle, 59000 Lille',
      latitude: 50.6292,
      longitude: 3.0573,
    },
  ];
  buildings.forEach((b) => store.buildings.set(b.id, b));

  // ── Zones ──────────────────────────────────────────────────────────────────
  const zones: Zone[] = [
    { id: 'z-001', buildingId: 'b-001', name: 'Zone A — Open Space' },
    { id: 'z-002', buildingId: 'b-001', name: 'Zone B — Salle Serveurs' },
    { id: 'z-003', buildingId: 'b-002', name: 'Zone C — Entrepôt' },
  ];
  zones.forEach((z) => store.zones.set(z.id, z));

  // ── Sensors ────────────────────────────────────────────────────────────────
  const sensors: Sensor[] = [
    // Zone A
    { id: 's-001', zoneId: 'z-001', type: 'temperature', status: 'active',      label: 'Capteur temp A-1' },
    { id: 's-002', zoneId: 'z-001', type: 'humidity',    status: 'active',      label: 'Capteur hum A-2' },
    { id: 's-003', zoneId: 'z-001', type: 'both',        status: 'active',      label: 'Capteur mixte A-3' },
    { id: 's-004', zoneId: 'z-001', type: 'temperature', status: 'offline',     label: 'Capteur temp A-4 (hors ligne)' },
    // Zone B
    { id: 's-005', zoneId: 'z-002', type: 'temperature', status: 'active',      label: 'Capteur temp B-1' },
    { id: 's-006', zoneId: 'z-002', type: 'temperature', status: 'active',      label: 'Capteur temp B-2' },
    { id: 's-007', zoneId: 'z-002', type: 'humidity',    status: 'faulty',      label: 'Capteur hum B-3 (défaillant)' },
    // Zone C
    { id: 's-008', zoneId: 'z-003', type: 'both',        status: 'active',      label: 'Capteur mixte C-1' },
    { id: 's-009', zoneId: 'z-003', type: 'temperature', status: 'maintenance', label: 'Capteur temp C-2 (maintenance)' },
  ];
  sensors.forEach((s) => store.sensors.set(s.id, s));

  // ── Actuators ──────────────────────────────────────────────────────────────
  const actuators: Actuator[] = [
    // Zone A
    { id: 'a-001', zoneId: 'z-001', type: 'heating',     status: 'auto',        label: 'Chauffage A-1' },
    { id: 'a-002', zoneId: 'z-001', type: 'ventilation', status: 'on',          label: 'Ventilation A-2' },
    // Zone B
    { id: 'a-003', zoneId: 'z-002', type: 'cooling',     status: 'on',          label: 'Climatisation B-1' },
    { id: 'a-004', zoneId: 'z-002', type: 'ventilation', status: 'maintenance', label: 'Ventilation B-2 (maintenance)' },
    // Zone C
    { id: 'a-005', zoneId: 'z-003', type: 'heating',     status: 'off',         label: 'Chauffage C-1' },
  ];
  actuators.forEach((a) => store.actuators.set(a.id, a));

  // ── Measurements (historique 24h) ──────────────────────────────────────────
  // Capteurs actifs uniquement, une mesure toutes les ~45 min sur 24h
  const activeSensors = sensors.filter((s) => s.status === 'active');
  const baselines: Record<string, { temp: number; hum: number }> = {
    'z-001': { temp: 21.5, hum: 45 },
    'z-002': { temp: 18.0, hum: 30 }, // salle serveurs plus froide
    'z-003': { temp: 14.0, hum: 60 }, // entrepôt
  };

  const measurements: Measurement[] = [];
  let measureId = 1;

  for (const sensor of activeSensors) {
    const base = baselines[sensor.zoneId] ?? { temp: 20, hum: 50 };
    const steps = 8; // 8 mesures par capteur sur 24h

    for (let i = steps; i >= 0; i--) {
      const offsetMin = i * (24 * 60 / steps);

      if (sensor.type === 'temperature' || sensor.type === 'both') {
        measurements.push({
          id: `m-${String(measureId++).padStart(4, '0')}`,
          sensorId: sensor.id,
          type: 'temperature',
          value: jitter(base.temp, 3),
          unit: '°C',
          timestamp: recentTimestamp(offsetMin),
        });
      }
      if (sensor.type === 'humidity' || sensor.type === 'both') {
        measurements.push({
          id: `m-${String(measureId++).padStart(4, '0')}`,
          sensorId: sensor.id,
          type: 'humidity',
          value: jitter(base.hum, 10),
          unit: '%',
          timestamp: recentTimestamp(offsetMin),
        });
      }
    }
  }

  // Injection d'une valeur aberrante pour réalisme
  measurements.push({
    id: `m-${String(measureId++).padStart(4, '0')}`,
    sensorId: 's-001',
    type: 'temperature',
    value: 38.5, // valeur hors plage normale
    unit: '°C',
    timestamp: recentTimestamp(15),
  });

  store.measurements.push(...measurements);

  // ── Users ──────────────────────────────────────────────────────────────────
  const users: User[] = [
    { id: 'u-001', username: 'admin',            role: 'admin' },
    { id: 'u-002', username: 'operator_zone_a',  role: 'operator', zoneId: 'z-001' },
    { id: 'u-003', username: 'operator_zone_b',  role: 'operator', zoneId: 'z-002' },
    { id: 'u-004', username: 'device_sensor_01', role: 'device' },
    { id: 'u-005', username: 'device_actuator_01', role: 'device' },
  ];
  users.forEach((u) => store.users.set(u.id, u));

  console.log(
    `[seed] ${store.buildings.size} bâtiments, ${store.zones.size} zones, ` +
    `${store.sensors.size} capteurs, ${store.actuators.size} actionneurs, ` +
    `${store.measurements.length} mesures, ${store.users.size} utilisateurs`
  );
}
