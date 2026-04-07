import 'dotenv/config';
import dns from 'node:dns';
import app from './app';
import { connectDB } from './db/connection';
import { seedDatabase } from './data/seed';

const PORT = process.env.PORT ?? 3000;

function configureDnsFromEnv(): void {
  const rawServers = process.env.DNS_SERVERS;
  if (!rawServers) return;

  const servers = rawServers
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (servers.length === 0) return;

  dns.setServers(servers);
  console.log(`[dns] Serveurs DNS forcés : ${servers.join(', ')}`);
}

async function main() {
  configureDnsFromEnv();
  await connectDB();
  await seedDatabase();

  app.listen(PORT, () => {
    console.log(`[server] ThermoSense API démarrée sur http://localhost:${PORT}`);
    console.log(`[server] Health check : http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error('[server] Erreur au démarrage :', err);
  process.exit(1);
});
