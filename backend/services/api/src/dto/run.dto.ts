export class StartRunDto {
  x: number;
  y: number;
}

export class RunStatusDto {
  running: boolean;
  xTotal: number;
  yPerMinute: number;
  enqueued: number;
  processed: number;
  startedAt?: string;
}

export class MessageResponseDto {
  message: string;
  x?: number;
  y?: number;
}
