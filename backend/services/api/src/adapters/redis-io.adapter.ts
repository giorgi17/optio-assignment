import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

/**
 * Redis adapter for Socket.IO to enable horizontal scaling of WebSocket connections
 *
 * Why we need this:
 * - Without adapter: Each API instance only knows about its own WebSocket clients
 * - With adapter: All API instances share client state via Redis Pub/Sub
 *
 * Example:
 * - Client A connects to API Instance 1
 * - Client B connects to API Instance 2
 * - Worker publishes update → Redis → Both instances receive it
 * - Both clients get the update, regardless of which instance they're connected to
 *
 * This allows us to scale the API service horizontally:
 * docker compose up --scale api=3
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.logger.log(
      `[api] Connecting Redis adapter for Socket.IO: ${redisUrl}`,
    );

    // Create two Redis clients (pub/sub pattern requires separate connections)
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    // Handle connection errors
    pubClient.on('error', (err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[api] Redis adapter pub client error: ${message}`);
    });

    subClient.on('error', (err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[api] Redis adapter sub client error: ${message}`);
    });

    // Connect both clients
    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.logger.log('[api] Redis adapter connected successfully');

    // Create the adapter
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.adapterConstructor);
    this.logger.log('[api] Socket.IO server configured with Redis adapter');
    return server;
  }
}
