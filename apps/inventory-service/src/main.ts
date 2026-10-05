import 'reflect-metadata';
import { runMain, startService } from '@market/nest-common';
import { AppModule } from './app.module.js';
import { loadConfig, SERVICE_NAME } from './config.js';

runMain(SERVICE_NAME, async () => {
  const config = loadConfig();
  await startService({
    serviceName: SERVICE_NAME,
    module: AppModule.register(config),
    config,
    openApi: { title: SERVICE_NAME },
    configure: { bodyLimit: '1mb' },
  });
});
