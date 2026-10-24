import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class RustFSService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.RUSTFS_BUCKET_NAME || 'videos';

    this.s3Client = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.RUSTFS_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.RUSTFS_ACCESS_KEY!,
        secretAccessKey: process.env.RUSTFS_SECRET_KEY!,
      },
      forcePathStyle: true,
      // Disable automatic AWS SDK v3 checksum injections that cause BadDigest with local S3 engines
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async initialmultipart(filename: string, filetype: string) {
    try {
      const date = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filekey = `video/${date}-${filename}`;

      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: filekey,
        ContentType: filetype,
      });
      const response = await this.s3Client.send(command);

      return { Id: response.UploadId, filekey };
    } catch (error) {
      console.log('multipart init error', error);
      throw new InternalServerErrorException(
        'Failed to initialize multipart upload',
      );
    }
  }

  async presignedpaart(filekey: string, uploadId: string, totalpart: number) {
    try {
      const url: { partnumber: number; presignedUrl: string }[] = [];

      for (let partnumber = 1; partnumber <= totalpart; partnumber++) {
        const command = new UploadPartCommand({
          Bucket: this.bucketName,
          Key: filekey,
          UploadId: uploadId,
          PartNumber: partnumber,
        });

        const presignedUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: 3600,
          // Instruct the signer not to sign a payload hash/checksum header that browsers omit
          unhoistableHeaders: new Set([
            'x-amz-checksum-algorithm',
            'x-amz-sdk-checksum-algorithm',
          ]),
        });

        url.push({ partnumber, presignedUrl });
      }

      return { parts: url };
    } catch (error) {
      console.log('failed to upload presigned', error);
      throw new InternalServerErrorException(
        'Failed to generate part presigned URLs',
      );
    }
  }

  async completeupload(
    filekey: string,
    uploadId: string,
    parts: { partnumber: number; etag: string }[],
  ) {
    try {
      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: filekey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .sort((a, b) => a.partnumber - b.partnumber)
            .map((p) => ({
              PartNumber: p.partnumber,
              ETag: p.etag,
            })),
        },
      });
      const response = await this.s3Client.send(command);
      return { location: response.Location, filekey };
    } catch (error) {
      console.log('error in completing', error);
      throw new InternalServerErrorException(
        'Failed to complete multipart upload',
      );
    }
  }

  async abortcancelmultipart(filekey: string, uploadId: string) {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: filekey,
        UploadId: uploadId,
      });
      await this.s3Client.send(command);
    } catch (error) {
      console.log('failed to perform abort', error);
    }
  }
}
