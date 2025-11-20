import ytdl from 'ytdl-core';
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

export class YouTubeDownloaderService {
  private tempDir: string;

  constructor() {
    this.tempDir = serviceConfigs.tempAudioDir;
    this.ensureTempDirExists();
  }

  /**
   * Ensure the temporary directory exists
   */
  private ensureTempDirExists(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      console.log(`Created temp directory: ${this.tempDir}`);
    }
  }

  /**
   * Extract video ID from YouTube URL
   */
  private extractVideoId(url: string): string {
    try {
      const videoId = ytdl.getVideoID(url);
      return videoId;
    } catch (error) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }
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
      const videoId = this.extractVideoId(url);
      const info = await ytdl.getInfo(url);

      const duration = parseInt(info.videoDetails.lengthSeconds);

      // Check video length limit
      if (duration > serviceConfigs.maxVideoLengthSeconds) {
        throw new Error(
          `Video duration (${duration}s) exceeds maximum allowed duration (${serviceConfigs.maxVideoLengthSeconds}s)`
        );
      }

      return {
        videoId,
        title: info.videoDetails.title,
        duration,
        thumbnail: info.videoDetails.thumbnails[0]?.url || ''
      };
    } catch (error: any) {
      console.error('Error getting video info:', error.message);
      throw error;
    }
  }

  /**
   * Download audio from YouTube video
   */
  async downloadAudio(url: string, videoId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Starting audio download for video: ${videoId}`);

        const outputPath = path.join(this.tempDir, `${videoId}.mp4`);

        // Check if file already exists
        if (fs.existsSync(outputPath)) {
          console.log(`Audio file already exists: ${outputPath}`);
          return resolve(outputPath);
        }

        const audioStream = ytdl(url, {
          quality: 'highestaudio',
          filter: 'audioonly'
        });

        const writeStream = fs.createWriteStream(outputPath);

        audioStream.pipe(writeStream);

        audioStream.on('progress', (chunkLength, downloaded, total) => {
          const percent = (downloaded / total * 100).toFixed(2);
          console.log(`Download progress: ${percent}%`);
        });

        writeStream.on('finish', () => {
          console.log(`Audio download completed: ${outputPath}`);
          resolve(outputPath);
        });

        audioStream.on('error', (error) => {
          console.error('Error downloading audio:', error);
          // Clean up partial file
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          reject(new Error(`Failed to download audio: ${error.message}`));
        });

        writeStream.on('error', (error) => {
          console.error('Error writing audio file:', error);
          reject(new Error(`Failed to write audio file: ${error.message}`));
        });
      } catch (error: any) {
        console.error('Error in downloadAudio:', error);
        reject(error);
      }
    });
  }

  /**
   * Delete audio file
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
   * Clean up old temporary files (older than 24 hours)
   */
  cleanupOldFiles(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old file: ${filePath}`);
        }
      });
    } catch (error: any) {
      console.error('Error cleaning up old files:', error.message);
    }
  }
}
