import youtubedl from 'youtube-dl-exec';
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
   * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
   */
  private extractVideoId(url: string): string {
    try {
      const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?/]+)/);
      if (!match) {
        throw new Error(`Invalid YouTube URL: ${url}`);
      }
      return match[1];
    } catch (error) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }
  }

  /**
   * Get common youtube-dl options with cookie and anti-bot configuration
   */
  private getCommonYtdlOptions(): any {
    const options: any = {
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      addHeader: [
        `User-Agent:${serviceConfigs.youtubeUserAgent}`
      ]
    };

    // Add cookies - prioritize cookies-from-browser for convenience
    if (serviceConfigs.youtubeCookiesBrowser) {
      options.cookiesFromBrowser = serviceConfigs.youtubeCookiesBrowser;
      console.log(`Using YouTube cookies from browser: ${serviceConfigs.youtubeCookiesBrowser}`);
    } else if (serviceConfigs.youtubeCookiesFile && fs.existsSync(serviceConfigs.youtubeCookiesFile)) {
      // Copy cookies to writable location to avoid read-only file system errors
      // Kubernetes Secret volumes are read-only, but yt-dlp tries to update cookies
      const writableCookiesPath = path.join(serviceConfigs.tempAudioDir, 'cookies.txt');

      try {
        // Ensure temp directory exists
        if (!fs.existsSync(serviceConfigs.tempAudioDir)) {
          fs.mkdirSync(serviceConfigs.tempAudioDir, { recursive: true });
        }

        // Copy cookies to writable location
        fs.copyFileSync(serviceConfigs.youtubeCookiesFile, writableCookiesPath);
        options.cookies = writableCookiesPath;
        console.log(`Using YouTube cookies from file: ${serviceConfigs.youtubeCookiesFile} (copied to ${writableCookiesPath})`);
      } catch (error: any) {
        console.warn(`Failed to copy cookies file: ${error.message}`);
        console.warn('Attempting to use read-only cookies file directly');
        options.cookies = serviceConfigs.youtubeCookiesFile;
      }
    } else {
      console.warn('No YouTube cookies configured - may encounter bot detection errors');
      console.warn('Configure YOUTUBE_COOKIES_BROWSER (e.g., "chrome") or YOUTUBE_COOKIES_FILE in environment');
    }

    return options;
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

      // Get video info using youtube-dl-exec with anti-bot configuration
      const options = {
        ...this.getCommonYtdlOptions(),
        dumpJson: true
      };

      const info: any = await youtubedl(url, options);

      const duration = Math.floor(info.duration || 0);

      // Check video length limit
      if (duration > serviceConfigs.maxVideoLengthSeconds) {
        throw new Error(
          `Video duration (${duration}s) exceeds maximum allowed duration (${serviceConfigs.maxVideoLengthSeconds}s)`
        );
      }

      return {
        videoId,
        title: info.title || 'Unknown',
        duration,
        thumbnail: info.thumbnail || ''
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
    try {
      console.log(`Starting audio download for video: ${videoId}`);

      // youtube-dl-exec with audioFormat 'm4a' creates a file with .mp4.m4a extension
      const outputPath = path.join(this.tempDir, `${videoId}.mp4.m4a`);

      // Check if file already exists
      if (fs.existsSync(outputPath)) {
        console.log(`Audio file already exists: ${outputPath}`);
        return outputPath;
      }

      // Download audio using youtube-dl-exec
      // Note: output path should NOT include the .m4a extension, youtube-dl will add it
      const tempOutputPath = path.join(this.tempDir, `${videoId}.mp4`);

      // Configure FFmpeg location for Windows
      const isWindows = process.platform === 'win32';
      const isDocker = process.env.ENV_NAME === 'deployed' || fs.existsSync('/.dockerenv');

      // Start with common options (includes cookies and headers)
      const ytdlOptions: any = {
        ...this.getCommonYtdlOptions(),
        extractAudio: true,
        audioFormat: 'm4a',
        output: tempOutputPath
      };

      // Add ffmpeg location for Windows local development
      if (isWindows && !isDocker) {
        const windowsPath = 'C:\\Users\\Renato\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-essentials_build\\bin';
        const ffmpegPath = path.join(windowsPath, 'ffmpeg.exe');
        if (fs.existsSync(ffmpegPath)) {
          ytdlOptions.ffmpegLocation = ffmpegPath;
          console.log(`Using FFmpeg at: ${ffmpegPath}`);
        }
      }

      await youtubedl(url, ytdlOptions);

      console.log(`Audio download completed: ${outputPath}`);
      return outputPath;
    } catch (error: any) {
      console.error('Error downloading audio:', error);
      // Clean up partial file (could be either .mp4 or .mp4.m4a)
      const outputPath1 = path.join(this.tempDir, `${videoId}.mp4`);
      const outputPath2 = path.join(this.tempDir, `${videoId}.mp4.m4a`);
      if (fs.existsSync(outputPath1)) {
        fs.unlinkSync(outputPath1);
      }
      if (fs.existsSync(outputPath2)) {
        fs.unlinkSync(outputPath2);
      }
      throw new Error(`Failed to download audio: ${error.message}`);
    }
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
