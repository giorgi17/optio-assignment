export interface RunState {
  running: boolean;
  xTotal: number;
  yMinutes: number; // Y = duration in minutes to process X jobs
  enqueued: number;
  processed: number;
  startedAt?: string;
}

export const DEFAULT_RUN_STATE: RunState = {
  running: false,
  xTotal: 0,
  yMinutes: 0,
  enqueued: 0,
  processed: 0,
};
