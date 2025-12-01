import axios, { AxiosInstance } from 'axios';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

// Job status types matching Python service
type JobStatus = 'pending' | 'downloading' | 'completed' | 'failed';

interface DownloadJobStatus {
  job_id: string;
  status: JobStatus;
  video_id: string;
  file_path?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Client for Python YouTube Downloader microservice
 * Uses dedicated Python service with native yt-dlp for better bot detection handling
 * Supports async "fire and forget" downloads with polling
 */
export class PythonYouTubeDownloaderService {
  private client: AxiosInstance;
  private downloaderUrl: string;

  // Polling configuration
  private readonly POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
  private readonly MAX_POLL_TIME_MS = 600000; // Max 10 minutes

  constructor() {
    this.downloaderUrl = serviceConfigs.pythonDownloaderUrl || 'http://localhost:3017';

    // Create HTTP agent with keepAlive
    const httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      timeout: 30000 // Short timeout for API calls (not downloads)
    });

    this.client = axios.create({
      baseURL: this.downloaderUrl,
      timeout: 30000, // Short timeout for API calls
      httpAgent: httpAgent,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      }
    });

    console.log(`Python YouTube Downloader client initialized: ${this.downloaderUrl}`);
  }

  /**
   * Get video information
   */
  async getVideoInfo(url: string): Promise<{
    videoId: string;
    title: string;
    duration: number;
    thumbnail: string;
  }> {
    try {
      console.log(`Getting video info from Python service: ${url}`);

      const response = await this.client.post('/info', { url });

      console.log(`✓ Video info retrieved: ${response.data.title}`);
      return {
        videoId: response.data.video_id,
        title: response.data.title,
        duration: response.data.duration,
        thumbnail: response.data.thumbnail || ''
      };
    } catch (error: any) {
      console.error(`Error getting video info from Python service:`, error.message);
      if (error.response?.data) {
        throw new Error(error.response.data.detail || error.message);
      }
      throw error;
    }
  }

  /**
   * Start async download job (fire and forget)
   * Returns job_id immediately
   */
  async startAsyncDownload(url: string, videoId: string, format: string = 'mp3'): Promise<string> {
    try {
      console.log(`Starting async download for video: ${videoId}`);

      const response = await this.client.post('/download/async', {
        url,
        video_id: videoId,
        format
      });

      const jobId = response.data.job_id;
      console.log(`✓ Async download job created: ${jobId}`);
      console.log(`  Status: ${response.data.status}`);
      console.log(`  Message: ${response.data.message}`);

      return jobId;
    } catch (error: any) {
      console.error(`Error starting async download:`, error.message);
      if (error.response?.data) {
        throw new Error(error.response.data.detail || error.message);
      }
      throw error;
    }
  }

  /**
   * Get status of a download job
   */
  async getDownloadStatus(jobId: string): Promise<DownloadJobStatus> {
    try {
      const response = await this.client.get(`/download/status/${jobId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error getting download status for job ${jobId}:`, error.message);
      if (error.response?.status === 404) {
        throw new Error(`Download job ${jobId} not found`);
      }
      throw error;
    }
  }

  /**
   * Get the downloaded file for a completed job
   */
  async getDownloadFile(jobId: string, videoId: string): Promise<string> {
    try {
      console.log(`Fetching downloaded file for job: ${jobId}`);

      const response = await this.client.get(`/download/file/${jobId}`, {
        responseType: 'arraybuffer',
        timeout: 60000 // 1 minute timeout for file transfer
      });

      // Save the audio file to temp directory
      const tempDir = serviceConfigs.tempAudioDir;
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const outputPath = path.join(tempDir, `${videoId}.mp3`);
      fs.writeFileSync(outputPath, response.data);

      const fileSizeKB = (response.data.length / 1024).toFixed(2);
      console.log(`✓ Audio file saved: ${outputPath}`);
      console.log(`  Size: ${fileSizeKB} KB`);

      return outputPath;
    } catch (error: any) {
      console.error(`Error fetching download file for job ${jobId}:`, error.message);
      throw error;
    }
  }

  /**
   * Download audio using async flow with polling
   * This is the main method to use - starts download and polls until complete
   */
  async downloadAudio(
    url: string,
    videoId: string,
    format: string = 'mp3'
  ): Promise<string> {
    try {
      console.log(`Downloading audio from Python service (async): ${url}`);
      console.log(`  Video ID: ${videoId}`);
      console.log(`  Format: ${format}`);

      // Step 1: Start the async download
      const jobId = await this.startAsyncDownload(url, videoId, format);

      // Step 2: Poll for completion
      console.log(`Polling for download completion (job: ${jobId})...`);
      const startTime = Date.now();

      while (true) {
        const elapsed = Date.now() - startTime;

        if (elapsed > this.MAX_POLL_TIME_MS) {
          throw new Error(`Download timed out after ${this.MAX_POLL_TIME_MS / 1000} seconds`);
        }

        const status = await this.getDownloadStatus(jobId);
        const elapsedSec = Math.floor(elapsed / 1000);
        console.log(`  [${elapsedSec}s] Job ${jobId}: ${status.status}`);

        if (status.status === 'completed') {
          console.log(`✓ Download completed in ${elapsedSec} seconds`);

          // Step 3: Fetch the file
          const filePath = await this.getDownloadFile(jobId, videoId);
          return filePath;
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Download failed');
        }

        // Wait before next poll
        await this.sleep(this.POLL_INTERVAL_MS);
      }
    } catch (error: any) {
      console.error(`Error downloading audio:`, error.message);
      throw error;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Delete audio file from temp directory
   */
  deleteAudioFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted audio file: ${filePath}`);
      }
    } catch (error: any) {
      console.error(`Error deleting audio file ${filePath}:`, error.message);
    }
  }

  /**
   * Clean up old files from temp directory
   */
  cleanupOldFiles(maxAgeMinutes: number = 60): void {
    try {
      const tempDir = serviceConfigs.tempAudioDir;
      if (!fs.existsSync(tempDir)) {
        return;
      }

      const files = fs.readdirSync(tempDir);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);

        if (ageMinutes > maxAgeMinutes) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old files from ${tempDir}`);
      }
    } catch (error: any) {
      console.error('Error cleaning up old files:', error.message);
    }
  }

  /**
   * Health check for Python downloader service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('Python downloader service health check failed:', error);
      return false;
    }
  }
}
