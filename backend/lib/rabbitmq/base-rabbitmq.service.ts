import { Logger, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { Connection, Channel } from 'amqplib';

/**
 * Base RabbitMQ service with shared connection management
 * Handles connection, reconnection, and channel lifecycle
 */
export abstract class BaseRabbitMQService implements OnModuleDestroy {
    protected readonly logger: Logger;
    protected connection: Connection | null = null;
    protected channel: Channel | null = null;
    protected readonly queueName = 'optio.jobs';
    protected reconnectTimeout: NodeJS.Timeout | null = null;
    protected isConnecting = false;

    constructor(serviceName: string) {
        this.logger = new Logger(serviceName);
    }

    async onModuleDestroy() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        await this.disconnect();
    }

    /**
     * Connect to RabbitMQ with retry logic
     * Can be overridden by subclasses for additional setup
     */
    protected async connect(): Promise<void> {
        if (this.isConnecting) {
            return;
        }

        this.isConnecting = true;
        const amqpUrl = process.env.AMQP_URL || 'amqp://localhost:5672';

        try {
            this.logger.log('Connecting to RabbitMQ...');

            // Create connection (type assertion needed due to incomplete @types/amqplib)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            this.connection = (await amqp.connect(amqpUrl)) as any;

            this.logger.log('RabbitMQ connected successfully');

            // Handle connection events
            this.connection!.on('error', (err: Error) => {
                this.logger.error(`RabbitMQ connection error: ${err.message}`);
            });

            this.connection!.on('close', () => {
                this.logger.warn('RabbitMQ connection closed, reconnecting...');
                this.connection = null;
                this.channel = null;
                this.scheduleReconnect();
            });

            // Create channel (type assertion needed due to incomplete @types/amqplib)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            this.channel = await (this.connection as any).createChannel();
            this.logger.log('RabbitMQ channel created');

            // Handle channel events
            this.channel!.on('error', (err: Error) => {
                this.logger.error(`RabbitMQ channel error: ${err.message}`);
            });

            this.channel!.on('close', () => {
                this.logger.warn('RabbitMQ channel closed');
                this.channel = null;
            });

            // Assert queue with durability
            await this.channel!.assertQueue(this.queueName, {
                durable: true, // Queue survives RabbitMQ restart
            });

            this.logger.log(
                `Queue '${this.queueName}' asserted (durable: true)`
            );

            // Call hook for service-specific initialization
            await this.onChannelReady();

            this.isConnecting = false;
        } catch (error) {
            this.isConnecting = false;
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to connect to RabbitMQ: ${message}`);
            this.scheduleReconnect();
        }
    }

    /**
     * Hook for service-specific initialization after channel is ready
     * Override this in subclasses to add custom setup (e.g., prefetch, start consuming)
     */
    protected async onChannelReady(): Promise<void> {
        // Default: no additional setup
    }

    /**
     * Schedule reconnection attempt
     */
    protected scheduleReconnect(): void {
        if (this.reconnectTimeout) {
            return;
        }

        const delay = 5000; // 5 seconds
        this.logger.log(`Scheduling reconnect in ${delay}ms...`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            void this.connect();
        }, delay);
    }

    /**
     * Disconnect from RabbitMQ
     */
    protected async disconnect(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
                this.logger.log('RabbitMQ channel closed');
            }

            if (this.connection) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                await (this.connection as any).close();
                this.connection = null;
                this.logger.log('RabbitMQ connection closed');
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(`Error during disconnect: ${message}`);
        }
    }

    /**
     * Check if RabbitMQ is connected
     */
    isConnected(): boolean {
        return this.connection !== null && this.channel !== null;
    }

    /**
     * Get channel for advanced operations
     */
    getChannel(): Channel | null {
        return this.channel;
    }
}
