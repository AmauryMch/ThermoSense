import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/thermosense';

export async function connectDB(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  console.log(`[db] Connecté à MongoDB : ${MONGO_URI}`);
}
