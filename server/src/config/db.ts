import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../shared/logger/logger.js';

/**
 * Database – SINGLETON wrapper around the Mongoose connection.
 * The whole app shares exactly one connection; `connect()` is idempotent.
 */
class Database {
  private static instance: Database | null = null;

  private connected = false;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public get isConnected(): boolean {
    return this.connected && mongoose.connection.readyState === 1;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;

    mongoose.set('strictQuery', true);

    try {
      const conn = await mongoose.connect(env.mongoUri);
      this.connected = true;
      logger.info(`MongoDB connected → ${conn.connection.host}`);

      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB runtime error', err);
      });
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.connected = false;
      });
    } catch (error) {
      logger.error('MongoDB initial connection failed', error as Error);
      process.exit(1);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.connected) return;
    await mongoose.disconnect();
    this.connected = false;
    logger.info('MongoDB connection closed');
  }
}

export const database = Database.getInstance();
