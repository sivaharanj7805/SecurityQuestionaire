import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

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

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
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

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
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

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
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
    Bucket: BUCKET,
    Key: fileKey,
  });

  return awsGetSignedUrl(s3Client, command, { expiresIn });
}
