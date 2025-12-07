import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import http from 'http';
import mongoose from 'mongoose';
import helmet from 'helmet';

// Note: dotenv is loaded in config/global.config.ts before any process.env access
import { serviceConfigs } from '../config/global.config';
import routes from './routes/default.api';

const debug = require('debug')('video-transcription:server');

class Server {
  private app: express.Express;
  private server: http.Server | null = null;

  constructor() {
    this.app = express();
  }

  /**
   * Start the server
   */
  public up = (): Promise<http.Server> => {
    return new Promise((resolve, reject) => {
      // Body parser middleware
      this.app.use(bodyParser.urlencoded({
        extended: true,
        limit: '50mb'
      }));
      this.app.use(bodyParser.json({
        limit: '50mb'
      }));

      // Security middleware
      this.app.use(helmet());

      // Logging middleware
      this.app.use(morgan('combined'));

      // CORS middleware
      this.app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        if (req.method === 'OPTIONS') {
          return res.sendStatus(200);
        }

        next();
      });

      // Start server
      this.server = this.app.listen(serviceConfigs.port, () => {
        console.log('==================================================');
        console.log(`✓ Video Transcription Service`);
        console.log(`  Port: ${serviceConfigs.port}`);
        console.log(`  Environment: ${serviceConfigs.envName}`);
        console.log(`  Provider: ${serviceConfigs.transcriptionProvider}`);
        console.log('==================================================');

        // Connect to MongoDB
        this.databaseConnect()
          .then(() => {
            // Register routes
            const router = routes(this.app, express);
            this.app.use('/', router);

            console.log('✓ Routes registered');
            console.log('==================================================');
            console.log('Service is ready to accept requests');
            console.log('==================================================\n');

            resolve(this.server!);
          })
          .catch(err => {
            console.error('✗ Unable to connect to database:', err.message);
            reject(err);
          });
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        console.error('Server error:', error);
        reject(error);
      });
    });
  };

  /**
   * Connect to MongoDB
   */
  private databaseConnect = async (): Promise<void> => {
    try {
      console.log('Connecting to MongoDB...');
      console.log(`  URL: ${serviceConfigs.mongoDbUrl}`);

      await mongoose.connect(serviceConfigs.mongoDbUrl, {
        // Removed deprecated options
      });

      console.log('✓ MongoDB connected successfully');

      // Handle MongoDB connection events
      mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
      });

    } catch (error: any) {
      console.error('✗ MongoDB connection failed:', error.message);
      throw error;
    }
  };

  /**
   * Graceful shutdown
   */
  public down = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('\nShutting down server...');

      if (this.server) {
        this.server.close((err) => {
          if (err) {
            console.error('Error closing server:', err);
            reject(err);
          } else {
            console.log('✓ Server closed');

            // Close MongoDB connection
            mongoose.connection.close(false).then(() => {
              console.log('✓ MongoDB connection closed');
              resolve();
            }).catch((mongoErr) => {
              console.error('Error closing MongoDB:', mongoErr);
              reject(mongoErr);
            });
          }
        });
      } else {
        resolve();
      }
    });
  };
}

export { Server };
