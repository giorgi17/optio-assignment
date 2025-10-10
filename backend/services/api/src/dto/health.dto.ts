export class HealthResponseDto {
  status: 'ok' | 'error';
  redis: {
    connected: boolean;
    message?: string;
  };
  timestamp: string;
}
