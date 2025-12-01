// Load environment variables BEFORE any other imports
import dotenv from 'dotenv';
dotenv.config();

import { Server } from './server';

const server = new Server();

// Start the server
server.up()
  .then((httpServer) => {
    console.log('Server started successfully');
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.down()
    .then(() => {
      console.log('Server shut down gracefully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.down()
    .then(() => {
      console.log('Server shut down gracefully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.down()
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
