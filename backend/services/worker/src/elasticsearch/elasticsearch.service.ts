import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export interface JobResult {
  jobId: number;
  runId: string;
  input: number;
  output: number;
  processedAt: string;
  timestamp: string;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client: Client;
  private readonly indexName = 'optio-jobs';

  async onModuleInit() {
    const esUrl = process.env.ES_URL || 'http://localhost:9200';
    this.logger.log(`[worker] Connecting to Elasticsearch: ${esUrl}`);

    this.client = new Client({ node: esUrl });

    // Test connection
    try {
      const health = await this.client.cluster.health();
      this.logger.log(
        `[worker] Elasticsearch connected successfully (status: ${health.status})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[worker] Failed to connect to Elasticsearch: ${message}`,
      );
    }

    // Ensure index exists
    await this.ensureIndex();
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('[worker] Elasticsearch connection closed');
  }

  /**
   * Ensure the index exists with proper mappings
   */
  private async ensureIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        this.logger.log(
          `[worker] Creating index '${this.indexName}' with mappings...`,
        );

        await this.client.indices.create({
          index: this.indexName,
          mappings: {
            properties: {
              jobId: { type: 'integer' },
              runId: { type: 'keyword' },
              input: { type: 'integer' },
              output: { type: 'integer' },
              processedAt: { type: 'date' },
              timestamp: { type: 'date' },
            },
          },
        });

        this.logger.log(`[worker] Index '${this.indexName}' created successfully`);
      } else {
        this.logger.log(`[worker] Index '${this.indexName}' already exists`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Failed to ensure index: ${message}`);
      throw error;
    }
  }

  /**
   * Index a job result with idempotent write (using _id=jobId)
   * If the same jobId is indexed multiple times, it will update the existing document
   */
  async indexJob(jobResult: JobResult): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: String(jobResult.jobId), // Use jobId as document ID for idempotency
        document: jobResult,
        refresh: false, // Don't refresh immediately for better performance
      });

      this.logger.debug(
        `[worker] Job ${jobResult.jobId} indexed successfully`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Failed to index job ${jobResult.jobId}: ${message}`);
      throw error;
    }
  }

  /**
   * Get total count of indexed documents
   */
  async getJobCount(): Promise<number> {
    try {
      const result = await this.client.count({ index: this.indexName });
      return result.count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[worker] Failed to get job count: ${message}`);
      return 0;
    }
  }

  /**
   * Get Elasticsearch client for custom operations if needed
   */
  getClient(): Client {
    return this.client;
  }
}

