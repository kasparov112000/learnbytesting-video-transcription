import mongoose, { Connection } from 'mongoose';
import { serviceConfigs } from '../../config/global.config';

/**
 * DatabaseService - Manages multiple MongoDB connections
 *
 * Supports dynamic database selection based on request origin:
 * - Local requests (localhost, 127.0.0.1) -> Local MongoDB
 * - Production requests (Tailscale IPs, K8s cluster) -> Production MongoDB
 */
class DatabaseService {
  private localConnection: Connection | null = null;
  private prodConnection: Connection | null = null;
  private isInitialized = false;

  // Tailscale IP ranges and K8s cluster identifiers
  private readonly prodOriginPatterns = [
    /^100\.\d+\.\d+\.\d+$/,           // Tailscale IPs (100.x.x.x)
    /^10\.\d+\.\d+\.\d+$/,            // K8s internal IPs (10.x.x.x)
    /orchestrator/i,                   // Orchestrator service
    /k8s/i,                            // K8s identifiers
  ];

  private readonly localOriginPatterns = [
    /^localhost$/i,
    /^127\.0\.0\.1$/,
    /^::1$/,
    /^192\.168\.\d+\.\d+$/,           // Local network
  ];

  /**
   * Initialize database connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing database connections...');

    // Create local connection
    console.log(`  Local MongoDB: ${serviceConfigs.mongoDbUrl}`);
    this.localConnection = mongoose.createConnection(serviceConfigs.mongoDbUrl);

    this.localConnection.on('connected', () => {
      console.log('✓ Local MongoDB connected');
    });

    this.localConnection.on('error', (err) => {
      console.error('Local MongoDB error:', err.message);
    });

    // Create production connection (only if different from local)
    if (serviceConfigs.mongoDbUrlProd !== serviceConfigs.mongoDbUrl) {
      console.log(`  Prod MongoDB: ${serviceConfigs.mongoDbUrlProd}`);
      this.prodConnection = mongoose.createConnection(serviceConfigs.mongoDbUrlProd);

      this.prodConnection.on('connected', () => {
        console.log('✓ Production MongoDB connected');
      });

      this.prodConnection.on('error', (err) => {
        console.error('Production MongoDB error:', err.message);
      });
    } else {
      console.log('  Prod MongoDB: Using same as local');
      this.prodConnection = this.localConnection;
    }

    // Wait for connections to be ready
    await Promise.all([
      this.waitForConnection(this.localConnection, 'local'),
      this.prodConnection !== this.localConnection
        ? this.waitForConnection(this.prodConnection, 'prod')
        : Promise.resolve()
    ]);

    this.isInitialized = true;
    console.log('✓ All database connections initialized');
  }

  private async waitForConnection(conn: Connection, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (conn.readyState === 1) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`${name} MongoDB connection timeout`));
      }, 30000);

      conn.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      conn.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Determine if request is from production (K8s/Tailscale)
   *
   * Priority:
   * 1. x-source-cluster header (most reliable - set by orchestrator)
   * 2. IP-based detection (fallback)
   */
  isProductionRequest(req: any): boolean {
    // PRIORITY 1: Check for explicit header from orchestrator (most reliable)
    // This header is set by the K8s orchestrator when routing to local services via Tailscale
    const sourceCluster = req.headers?.['x-source-cluster'];
    if (sourceCluster === 'k8s' || sourceCluster === 'production') {
      console.log('[DB] ✓ PRODUCTION request detected via x-source-cluster header:', sourceCluster);
      return true;
    }

    // PRIORITY 2: Check various headers and properties for IP-based detection
    const indicators = [
      req.ip,
      req.headers?.['x-forwarded-for'],
      req.headers?.['x-real-ip'],
      req.headers?.['host'],
      req.headers?.['x-origin-source'],
      req.connection?.remoteAddress,
    ].filter(Boolean);

    const indicatorStr = indicators.join(' ');

    // Check for production patterns (Tailscale IPs, K8s internal IPs)
    for (const pattern of this.prodOriginPatterns) {
      if (pattern.test(indicatorStr)) {
        console.log(`[DB] ✓ PRODUCTION request detected via IP: ${indicatorStr}`);
        return true;
      }
    }

    // Default to local
    console.log(`[DB] Local request: ${indicatorStr}`);
    return false;
  }

  /**
   * Get the appropriate connection based on request origin
   */
  getConnection(req?: any): Connection {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    if (req && this.isProductionRequest(req)) {
      return this.prodConnection!;
    }

    return this.localConnection!;
  }

  /**
   * Get local connection directly
   */
  getLocalConnection(): Connection {
    if (!this.localConnection) {
      throw new Error('Local database connection not initialized');
    }
    return this.localConnection;
  }

  /**
   * Get production connection directly
   */
  getProdConnection(): Connection {
    if (!this.prodConnection) {
      throw new Error('Production database connection not initialized');
    }
    return this.prodConnection;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    console.log('Closing database connections...');

    if (this.localConnection) {
      await this.localConnection.close();
      console.log('✓ Local MongoDB closed');
    }

    if (this.prodConnection && this.prodConnection !== this.localConnection) {
      await this.prodConnection.close();
      console.log('✓ Production MongoDB closed');
    }

    this.isInitialized = false;
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
