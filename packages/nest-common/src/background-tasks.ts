import type { BeforeApplicationShutdown, OnApplicationBootstrap, Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

export interface BackgroundTask {
  stop(): Promise<void>;
}

/** Starts work that runs beside HTTP (Kafka relay/consumers) once DI is ready. */
export type BackgroundTaskFactory = (moduleRef: ModuleRef) => Promise<BackgroundTask>;

/**
 * Runs background tasks inside the Nest lifecycle: started after bootstrap (so
 * handlers can use any provider), stopped before shutdown hooks close the
 * database pool, so in-flight messages finish first.
 */
export class BackgroundTasksHost implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private task: BackgroundTask | undefined;

  constructor(
    private readonly factory: BackgroundTaskFactory,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.task = await this.factory(this.moduleRef);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.task?.stop();
  }
}

export function backgroundTasks(factory: BackgroundTaskFactory): Provider {
  return {
    provide: BackgroundTasksHost,
    useFactory: (moduleRef: ModuleRef) => new BackgroundTasksHost(factory, moduleRef),
    inject: [ModuleRef],
  };
}
