import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RunState {
  running: boolean;
  xTotal: number;
  yMinutes: number;
  enqueued: number;
  processed: number;
  startedAt?: string;
}

export interface RunRequest {
  x: number;
  y: number;
}

export interface ApiResponse {
  message: string;
  x?: number;
  y?: number;
}

@Injectable({
  providedIn: 'root',
})
export class Api {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * Start a new run with X jobs per Y minutes
   */
  startRun(x: number, y: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/run`, { x, y });
  }

  /**
   * Stop the current run
   */
  stopRun(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/stop`, {});
  }

  /**
   * Get current run status
   */
  getStatus(): Observable<RunState> {
    return this.http.get<RunState>(`${this.apiUrl}/status`);
  }

  /**
   * Update X/Y parameters dynamically while running
   */
  updateRun(x: number, y: number): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/run`, { x, y });
  }
}
