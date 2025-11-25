import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

/**
 * Client for Python YouTube Downloader microservice
 * Uses dedicated Python service with native yt-dlp for better bot detection handling
 */
export class PythonYouTubeDownloaderService {
  private client: AxiosInstance;
  private downloaderUrl: string;

  constructor() {
    this.downloaderUrl = serviceConfigs.pythonDownloaderUrl || 'http://localhost:3017';

    this.client = axios.create({
      baseURL: this.downloaderUrl,
      timeout: 300000, // 5 minutes for downloads
      headers: {
        'Content-Type': 'application/json'
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
   * Download audio from YouTube video
   * Returns the path to the downloaded audio file
   */
  async downloadAudio(
    url: string,
    videoId: string,
    format: string = 'm4a'
  ): Promise<string> {
    try {
      console.log(`Downloading audio from Python service: ${url}`);
      console.log(`  Format: ${format}`);

      const response = await this.client.post('/download', {
        url,
        format,
        extract_audio: true
      }, {
        responseType: 'arraybuffer' // Receive binary data
      });

      // Save the audio file to temp directory
      const tempDir = serviceConfigs.tempAudioDir;
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const outputPath = path.join(tempDir, `${videoId}.${format}`);
      fs.writeFileSync(outputPath, response.data);

      const fileSizeKB = (response.data.length / 1024).toFixed(2);
      console.log(`✓ Audio downloaded successfully: ${outputPath}`);
      console.log(`  Size: ${fileSizeKB} KB`);

      return outputPath;
    } catch (error: any) {
      console.error(`Error downloading audio from Python service:`, error.message);

      if (error.response?.status === 403) {
        throw new Error('YouTube bot detection triggered - download blocked');
      }

      if (error.response?.data) {
        // Try to parse error from response
        try {
          const errorText = Buffer.from(error.response.data).toString('utf8');
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.detail || error.message);
        } catch (parseError) {
          throw new Error(error.message);
        }
      }

      throw error;
    }
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
