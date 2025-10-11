export interface JobMessage {
  jobId: number;
  data: {
    runId: string;
    number: number;
    timestamp: string;
  };
  timestamp: string;
}

