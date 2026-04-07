import { ISensor } from '../db/models';

const ZONE_BASELINES: Record<string, { temp: number; hum: number }> = {
  'z-001': { temp: 21.5, hum: 45 },
  'z-002': { temp: 18.0, hum: 30 },
  'z-003': { temp: 14.0, hum: 60 },
};

const DEFAULT_BASELINE = { temp: 20.0, hum: 50 };

function jitter(base: number, range: number): number {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
}

export function generateTemperature(sensor: ISensor): number {
  const base = ZONE_BASELINES[sensor.zoneId] ?? DEFAULT_BASELINE;
  if (Math.random() < 0.01) return jitter(45, 10); // valeur aberrante occasionnelle
  return jitter(base.temp, 3);
}

export function generateHumidity(sensor: ISensor): number {
  const base = ZONE_BASELINES[sensor.zoneId] ?? DEFAULT_BASELINE;
  return Math.min(100, Math.max(0, jitter(base.hum, 10)));
}
