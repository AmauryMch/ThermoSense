import { Sensor } from '../types';

// Valeurs de base par type de zone (approximations réalistes)
const ZONE_BASELINES: Record<string, { temp: number; hum: number }> = {
  'z-001': { temp: 21.5, hum: 45 },
  'z-002': { temp: 18.0, hum: 30 },
  'z-003': { temp: 14.0, hum: 60 },
};

const DEFAULT_BASELINE = { temp: 20.0, hum: 50 };

function jitter(base: number, range: number): number {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
}

// Génère une valeur de température vraisemblable pour un capteur donné
export function generateTemperature(sensor: Sensor): number {
  const base = ZONE_BASELINES[sensor.zoneId] ?? DEFAULT_BASELINE;
  // 1% de chance de valeur aberrante pour simuler un capteur défaillant
  if (Math.random() < 0.01) return jitter(45, 10);
  return jitter(base.temp, 3);
}

// Génère une valeur d'humidité vraisemblable
export function generateHumidity(sensor: Sensor): number {
  const base = ZONE_BASELINES[sensor.zoneId] ?? DEFAULT_BASELINE;
  const raw = jitter(base.hum, 10);
  return Math.min(100, Math.max(0, raw));
}
