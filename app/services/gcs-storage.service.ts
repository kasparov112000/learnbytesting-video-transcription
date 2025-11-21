import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

export class GCSStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    try {
      // Initialize Google Cloud Storage client
      this.storage = new Storage({
        projectId: serviceConfigs.googleCloudProjectId,
        keyFilename: serviceConfigs.googleApplicationCredentials
      });

      this.bucketName = serviceConfigs.gcsBucketName || 'lbt-video-transcription-temp';

      console.log(`GCS Storage initialized with bucket: ${this.bucketName}`);
    } catch (error: any) {
      console.error('Error initializing GCS Storage:', error.message);
      throw new Error(`Failed to initialize GCS Storage: ${error.message}`);
    }
  }

  /**
   * Upload a file to Google Cloud Storage
   * @param localFilePath Path to the local file
   * @param destinationFileName Name for the file in GCS (optional)
   * @returns GCS URI (gs://bucket/filename)
   */
  async uploadFile(localFilePath: string, destinationFileName?: string): Promise<string> {
    try {
      const fileName = destinationFileName || path.basename(localFilePath);

      console.log(`Uploading file to GCS: ${fileName}`);

      // Ensure bucket exists before uploading
      await this.ensureBucketExists();

      const bucket = this.storage.bucket(this.bucketName);

      // Upload the file
      await bucket.upload(localFilePath, {
        destination: fileName,
        metadata: {
          cacheControl: 'no-cache',
        },
      });

      const gcsUri = `gs://${this.bucketName}/${fileName}`;
      console.log(`File uploaded successfully: ${gcsUri}`);

      return gcsUri;

    } catch (error: any) {
      console.error('Error uploading file to GCS:', error.message);
      throw new Error(`Failed to upload file to GCS: ${error.message}`);
    }
  }

  /**
   * Delete a file from Google Cloud Storage
   * @param fileName Name of the file to delete
   */
  async deleteFile(fileName: string): Promise<void> {
    try {
      console.log(`Deleting file from GCS: ${fileName}`);

      const bucket = this.storage.bucket(this.bucketName);
      await bucket.file(fileName).delete();

      console.log(`File deleted successfully: ${fileName}`);

    } catch (error: any) {
      console.error(`Error deleting file from GCS: ${error.message}`);
      // Don't throw - deletion errors shouldn't break the flow
    }
  }

  /**
   * Delete a file using GCS URI
   * @param gcsUri Full GCS URI (gs://bucket/filename)
   */
  async deleteFileByUri(gcsUri: string): Promise<void> {
    try {
      // Extract filename from URI (gs://bucket/filename -> filename)
      const fileName = gcsUri.split('/').pop();
      if (fileName) {
        await this.deleteFile(fileName);
      }
    } catch (error: any) {
      console.error(`Error deleting file by URI: ${error.message}`);
    }
  }

  /**
   * Check if a bucket exists, create if it doesn't
   */
  async ensureBucketExists(): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();

      if (!exists) {
        console.log(`Creating GCS bucket: ${this.bucketName}`);
        await this.storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
        });
        console.log(`Bucket created: ${this.bucketName}`);
      } else {
        console.log(`Bucket already exists: ${this.bucketName}`);
      }

    } catch (error: any) {
      console.error('Error ensuring bucket exists:', error.message);
      throw new Error(`Failed to ensure bucket exists: ${error.message}`);
    }
  }

  /**
   * List all files in the bucket
   */
  async listFiles(): Promise<string[]> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles();

      return files.map(file => file.name);

    } catch (error: any) {
      console.error('Error listing files:', error.message);
      return [];
    }
  }

  /**
   * Clean up old files (older than 24 hours)
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      console.log('Cleaning up old files from GCS...');

      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles();

      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const createdTime = new Date(metadata.timeCreated).getTime();

        if (now - createdTime > maxAge) {
          await file.delete();
          console.log(`Deleted old file: ${file.name}`);
        }
      }

      console.log('Cleanup completed');

    } catch (error: any) {
      console.error('Error cleaning up old files:', error.message);
    }
  }
}
