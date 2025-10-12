import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ProgressUpdate {
  running: boolean;
  xTotal: number;
  yMinute: number;
  enqueued: number;
  processed: number;
}

@Injectable({
  providedIn: 'root',
})
export class Websocket {
  private socket: Socket | null = null;
  private progressSubject = new BehaviorSubject<ProgressUpdate | null>(null);
  private connectionSubject = new BehaviorSubject<boolean>(false);

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    console.log('[WebSocket] Connecting to server...');

    // Use relative URL - works in both dev (proxy) and production (nginx)
    // In dev: proxy.conf.json forwards to localhost:3000
    // In production: nginx forwards to api:3000
    this.socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected successfully!');
      this.connectionSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      this.connectionSubject.next(false);
    });

    this.socket.on('progress', (data: ProgressUpdate) => {
      console.log('[WebSocket] Progress update:', data);
      this.progressSubject.next(data);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[WebSocket] Connection error:', error.message);
      this.connectionSubject.next(false);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[WebSocket] Disconnected');
    }
  }

  /**
   * Get progress updates as Observable
   */
  getProgress(): Observable<ProgressUpdate | null> {
    return this.progressSubject.asObservable();
  }

  /**
   * Get connection status as Observable
   */
  getConnectionStatus(): Observable<boolean> {
    return this.connectionSubject.asObservable();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
