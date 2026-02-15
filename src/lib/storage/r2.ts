import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY."
    );
  }

  _s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _s3Client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME is not configured.");
  }
  return bucket;
}

function buildKey(orgId: string, filename: string): string {
  const id = randomUUID();
  return `${orgId}/documents/${id}/${filename}`;
}

export async function uploadFile(
  orgId: string,
  file: Buffer,
  metadata: { filename: string; contentType: string }
): Promise<{ fileKey: string; fileSize: number }> {
  const fileKey = buildKey(orgId, metadata.filename);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: fileKey,
      Body: file,
      ContentType: metadata.contentType,
      Metadata: {
        orgId,
        originalFilename: metadata.filename,
      },
    })
  );

  return { fileKey, fileSize: file.length };
}

export async function downloadFile(
  orgId: string,
  fileKey: string
): Promise<ReadableStream | null> {
  if (!fileKey.startsWith(`${orgId}/`)) {
    throw new Error("Access denied: file does not belong to this organization");
  }

  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: fileKey,
    })
  );

  return (response.Body as ReadableStream) ?? null;
}

export async function deleteFile(
  orgId: string,
  fileKey: string
): Promise<void> {
  if (!fileKey.startsWith(`${orgId}/`)) {
    throw new Error("Access denied: file does not belong to this organization");
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: fileKey,
    })
  );
}

export async function getSignedUrl(
  orgId: string,
  fileKey: string,
  expiresIn = 3600
): Promise<string> {
  if (!fileKey.startsWith(`${orgId}/`)) {
    throw new Error("Access denied: file does not belong to this organization");
  }

  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: fileKey,
  });

  return awsGetSignedUrl(getS3Client(), command, { expiresIn });
}
