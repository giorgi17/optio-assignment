/**
 * Shared interface for job messages in the queue
 */
export interface JobMessage {
    jobId: number;
    data: {
        runId: string;
        number: number;
        timestamp: string;
    };
    timestamp: string;
}
