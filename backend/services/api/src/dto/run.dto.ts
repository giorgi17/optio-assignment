export class StartRunDto {
  x: number;
  y: number;
}

export class UpdateRunDto {
  x: number;
  y: number;
}

export class RunStatusDto {
  running: boolean;
  xTotal: number;
  yMinutes: number; // Y = duration in minutes to process X jobs
  enqueued: number;
  processed: number;
  startedAt?: string;
}

export class MessageResponseDto {
  message: string;
  x?: number;
  y?: number;
}
