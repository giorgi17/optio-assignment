import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    credentials: true,
  },
})
export class ProgressGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProgressGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`[api] WebSocket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`[api] WebSocket client disconnected: ${client.id}`);
  }

  // Method to broadcast progress updates (will be used in TASK-6)
  broadcastProgress(data: {
    running: boolean;
    xTotal: number;
    yPerMinute: number;
    enqueued: number;
    processed: number;
  }): void {
    this.logger.log(
      `[api] Broadcasting progress: processed=${data.processed}/${data.xTotal}`,
    );
    this.server.emit('progress', data);
  }
}
