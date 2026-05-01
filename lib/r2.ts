import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _r2: S3Client | null = null;

function getR2Client(): S3Client {
  if (_r2) return _r2;
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 environment variables");
  }
  _r2 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _r2;
}

function getBucketName(): string {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) throw new Error("Missing CLOUDFLARE_R2_BUCKET_NAME");
  return bucket;
}

export async function listR2Objects(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const cmd = new ListObjectsV2Command({
      Bucket: getBucketName(),
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const res = await getR2Client().send(cmd);
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

export async function getR2ObjectText(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: getBucketName(), Key: key });
  const res = await getR2Client().send(cmd);
  if (!res.Body) return "";
  return res.Body.transformToString();
}

export async function getPresignedGetUrl(
  key: string,
  ttlSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucketName(), Key: key });
  return getSignedUrl(getR2Client(), command, { expiresIn: ttlSeconds });
}

export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  ttlSeconds = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn: ttlSeconds });
}
