import app from './app';
import { seedDatabase } from './data/seed';

const PORT = process.env.PORT ?? 3000;

seedDatabase();

app.listen(PORT, () => {
  console.log(`[server] ThermoSense API démarrée sur http://localhost:${PORT}`);
  console.log(`[server] Health check : http://localhost:${PORT}/health`);
});
