import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

dotenv.config({ path: 'server/.env' });

export async function createTestDatabase() {
  // Native MongoDB downloads are blocked on this laptop. Use a separate test
  // database on the configured server when TEST_MONGO_URI is supplied.
  const uri = process.env.TEST_MONGO_URI;
  if (!uri) return MongoMemoryServer.create();
  const dbName = `acl_lab_${randomBytes(12).toString('hex')}`;
  const queryIndex = uri.indexOf('?');
  const base = queryIndex < 0 ? uri : uri.slice(0, queryIndex);
  const query = queryIndex < 0 ? '' : uri.slice(queryIndex);
  const pathIndex = base.indexOf('/', base.indexOf('://') + 3);
  const authority = pathIndex < 0 ? `${base}/` : base.slice(0, pathIndex + 1);
  const isolatedUri = `${authority}${dbName}${query}`;
  return {
    getUri: () => isolatedUri,
    async stop() {
      if (!/^acl_lab_[a-f0-9]{24}$/.test(dbName)) throw new Error('Invalid test database name');
      const cleanup = await mongoose.createConnection(isolatedUri, { serverSelectionTimeoutMS: 10000 }).asPromise();
      try {
        for (const name of ['users', 'bookings', 'maintenancerequests']) {
          await cleanup.collection(name).deleteMany({});
        }
      } finally { await cleanup.close(); }
    }
  };
}
