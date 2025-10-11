import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, RunState } from './services/api';
import { Websocket, ProgressUpdate } from './services/websocket';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  // Form inputs
  xInput: number = 100;
  yInput: number = 1;

  // Current state
  running: boolean = false;
  xTotal: number = 0;
  yMinutes: number = 0;
  enqueued: number = 0;
  processed: number = 0;
  startedAt: string | null = null;

  // Connection status
  apiConnected: boolean = false;
  wsConnected: boolean = false;

  // UI state
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(private api: Api, private websocket: Websocket) {}

  ngOnInit(): void {
    console.log('[App] Initializing...');

    // Get initial status once on page load
    this.loadStatus();

    // Connect to WebSocket
    this.websocket.connect();

    // Subscribe to WebSocket connection status
    this.websocket.getConnectionStatus().subscribe((connected) => {
      this.wsConnected = connected;
      // Use WebSocket status as API status indicator
      // (if WebSocket connects, API must be alive)
      this.apiConnected = connected;
      console.log('[App] WebSocket status:', connected);
    });

    // Subscribe to progress updates (real-time, no polling!)
    this.websocket.getProgress().subscribe((progress) => {
      if (progress) {
        this.updateFromProgress(progress);
      }
    });
  }

  ngOnDestroy(): void {
    this.websocket.disconnect();
  }

  /**
   * Load current status from API
   */
  loadStatus(): void {
    this.api.getStatus().subscribe({
      next: (status) => {
        this.updateFromStatus(status);
        this.apiConnected = true;
      },
      error: (error) => {
        console.error('[App] Failed to load status:', error);
        this.apiConnected = false;
      },
    });
  }

  /**
   * Start a new run
   */
  startRun(): void {
    if (!this.validateInputs()) {
      return;
    }

    this.errorMessage = null;
    this.successMessage = null;

    this.api.startRun(this.xInput, this.yInput).subscribe({
      next: () => {
        this.successMessage = 'Run started successfully!';
        this.loadStatus();
        setTimeout(() => (this.successMessage = null), 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Failed to start run';
        console.error('[App] Start failed:', error);
      },
    });
  }

  /**
   * Stop the current run
   */
  stopRun(): void {
    this.errorMessage = null;
    this.successMessage = null;

    this.api.stopRun().subscribe({
      next: () => {
        this.successMessage = 'Run stopped successfully!';
        this.loadStatus();
        setTimeout(() => (this.successMessage = null), 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Failed to stop run';
        console.error('[App] Stop failed:', error);
      },
    });
  }

  /**
   * Update X/Y parameters while running
   */
  updateRun(): void {
    if (!this.validateInputs()) {
      return;
    }

    this.errorMessage = null;
    this.successMessage = null;

    this.api.updateRun(this.xInput, this.yInput).subscribe({
      next: () => {
        this.successMessage = 'Rate updated successfully!';
        this.loadStatus();
        setTimeout(() => (this.successMessage = null), 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Failed to update run';
        console.error('[App] Update failed:', error);
      },
    });
  }

  /**
   * Validate form inputs
   */
  validateInputs(): boolean {
    if (!this.xInput || this.xInput <= 0) {
      this.errorMessage = 'X must be greater than 0';
      return false;
    }
    if (!this.yInput || this.yInput <= 0) {
      this.errorMessage = 'Y must be greater than 0';
      return false;
    }
    return true;
  }

  /**
   * Update state from API status
   */
  updateFromStatus(status: RunState): void {
    this.running = status.running;
    this.xTotal = status.xTotal;
    this.yMinutes = status.yMinutes;
    this.enqueued = status.enqueued;
    this.processed = status.processed;
    this.startedAt = status.startedAt || null;
  }

  /**
   * Update state from WebSocket progress
   */
  updateFromProgress(progress: ProgressUpdate): void {
    this.running = progress.running;
    this.xTotal = progress.xTotal;
    this.yMinutes = progress.yMinute;
    this.enqueued = progress.enqueued;
    this.processed = progress.processed;
  }

  /**
   * Calculate progress percentage
   */
  get progressPercent(): number {
    if (this.enqueued === 0) return 0;
    return Math.min(100, (this.processed / this.enqueued) * 100);
  }

  /**
   * Calculate current processing rate (jobs/min)
   */
  get currentRate(): number {
    if (!this.startedAt || this.processed === 0) return 0;

    const startTime = new Date(this.startedAt).getTime();
    const now = new Date().getTime();
    const elapsedMinutes = (now - startTime) / 1000 / 60;

    if (elapsedMinutes === 0) return 0;

    return Math.round(this.processed / elapsedMinutes);
  }

  /**
   * Format timestamp for display
   */
  formatTime(isoString: string | null): string {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString();
  }

  /**
   * Format number with commas
   */
  formatNumber(num: number): string {
    return num.toLocaleString();
  }
}
