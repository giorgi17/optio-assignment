import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Api } from './services/api';
import { Websocket } from './services/websocket';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  constructor(private api: Api, private websocket: Websocket) {}

  ngOnInit(): void {
    console.log('[App] Initializing...');

    // Test API service
    this.api.getStatus().subscribe({
      next: (status) => {
        console.log('[App] API test successful! Status:', status);
      },
      error: (error) => {
        console.error('[App] API test failed:', error);
      },
    });

    // Connect to WebSocket
    this.websocket.connect();

    // Subscribe to progress updates
    this.websocket.getProgress().subscribe((progress) => {
      if (progress) {
        console.log('[App] Progress update received:', progress);
      }
    });

    // Subscribe to connection status
    this.websocket.getConnectionStatus().subscribe((connected) => {
      console.log('[App] WebSocket connection status:', connected);
    });
  }

  ngOnDestroy(): void {
    console.log('[App] Cleaning up...');
    this.websocket.disconnect();
  }
}
