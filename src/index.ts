import 'dotenv/config';
import app from './app';
import { connectDB } from './db/connection';
import { seedDatabase } from './data/seed';

const PORT = process.env.PORT ?? 3000;

async function main() {
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
