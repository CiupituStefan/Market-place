import { DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

export interface PresignedUpload {
  url: string;
  /** Form fields the browser must send with the file (policy, signature, key...). */
  fields: Record<string, string>;
  key: string;
  expiresAt: string;
}

/** Object storage seen by the catalog. S3 in production, MinIO locally, a fake in tests. */
export interface ObjectStorage {
  presignUpload(key: string, contentType: string, maxBytes: number): Promise<PresignedUpload>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

const UPLOAD_TTL_SECONDS = 300;

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    options: { region: string; endpoint?: string | undefined },
  ) {
    // Credentials come from the default provider chain (IRSA on EKS), never from config.
    this.client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true } : {}),
    });
  }

  async presignUpload(
    key: string,
    contentType: string,
    maxBytes: number,
  ): Promise<PresignedUpload> {
    // A POST policy (unlike a presigned PUT) lets S3 enforce size and type itself.
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      Expires: UPLOAD_TTL_SECONDS,
    });
    return {
      url,
      fields,
      key,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
