import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createLogger } from '@market/logger';
import { loadConfig, SERVICE_NAME } from '../config.js';

/**
 * `pnpm --filter @market/product-service storage:init` — local development only:
 * creates the image bucket in the S3-compatible store of Docker Compose, lets the
 * storefront upload with pre-signed forms (CORS) and read images anonymously (in
 * AWS that is CloudFront with origin access control, provisioned by Terraform).
 */
const logger = createLogger({ service: `${SERVICE_NAME}-storage-init` });
const config = loadConfig();

if (config.NODE_ENV === 'production') {
  logger.fatal('refusing to change bucket policies in production (Terraform owns them)');
  process.exit(1);
}
if (!config.S3_BUCKET || !config.S3_ENDPOINT) {
  logger.fatal('S3_BUCKET and S3_ENDPOINT are required');
  process.exit(1);
}

const Bucket = config.S3_BUCKET;
const client = new S3Client({
  region: config.S3_REGION,
  endpoint: config.S3_ENDPOINT,
  forcePathStyle: true,
});
const origins = (process.env.STORAGE_CORS_ORIGINS ?? 'http://localhost:3000').split(',');

try {
  const exists = await client.send(new HeadBucketCommand({ Bucket })).then(
    () => true,
    () => false,
  );
  if (!exists) await client.send(new CreateBucketCommand({ Bucket }));
  await client.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          { AllowedOrigins: origins, AllowedMethods: ['POST', 'GET'], AllowedHeaders: ['*'] },
        ],
      },
    }),
  );
  await client.send(
    new PutBucketPolicyCommand({
      Bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${Bucket}/*`],
          },
        ],
      }),
    }),
  );
  logger.info({ bucket: Bucket, created: !exists, origins }, 'image bucket ready');
} catch (error) {
  logger.fatal({ err: error }, 'could not prepare the image bucket');
  process.exitCode = 1;
} finally {
  client.destroy();
}
