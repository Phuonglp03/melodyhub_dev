import mongoose from 'mongoose';

export async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/melodyhub';
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  console.log('Connected to MongoDB');
}


