import youtubedl from 'youtube-dl-exec';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

export class YouTubeDownloaderService {
  private tempDir: string;
  private cookiesPath: string | undefined;
  private browserCookies: string | undefined;

  constructor() {
    this.tempDir = serviceConfigs.tempAudioDir;
    this.ensureTempDirExists();

    // Check for browser to extract cookies from
    this.browserCookies = process.env.YOUTUBE_COOKIES_BROWSER || 'chrome';

    // Check for cookies file and copy to writable location
    const sourceCookiesFile = process.env.YOUTUBE_COOKIES_FILE || '/etc/youtube-cookies/cookies.txt';
    if (fs.existsSync(sourceCookiesFile)) {
      // Copy cookies to a writable location since ConfigMap mounts are read-only
      const writableCookiesPath = path.join(this.tempDir, 'youtube-cookies.txt');
      try {
        fs.copyFileSync(sourceCookiesFile, writableCookiesPath);
        // Make the file writable
        fs.chmodSync(writableCookiesPath, 0o666);
        this.cookiesPath = writableCookiesPath;
        console.log(`YouTube cookies copied to writable location: ${writableCookiesPath}`);
      } catch (error) {
        console.error('Error copying cookies file:', error);
        console.log('Proceeding without cookies authentication');
      }
    } else if (this.browserCookies) {
      console.log(`Will attempt to use cookies from browser: ${this.browserCookies}`);
    } else {
      console.log('No YouTube cookies configured, proceeding without authentication');
    }
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

      // Get video info using youtube-dl-exec
      const ytdlOptions: any = {
        dumpJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        // Add user agent to avoid bot detection
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // Add referer
        referer: 'https://www.youtube.com/',
        // Sleep interval to avoid rate limiting
        sleepInterval: 1,
        maxSleepInterval: 3,
        // Use different extraction method to bypass restrictions
        extractorArgs: 'youtube:player_client=web',
        // Force IPv4
        forceIpv4: true
      };

      // Add cookies if available
      if (this.cookiesPath) {
        ytdlOptions.cookies = this.cookiesPath;
      } else if (this.browserCookies && process.platform !== 'linux') {
        // Use cookies from browser (only works on non-containerized environments)
        ytdlOptions.cookiesFromBrowser = this.browserCookies;
      }

      let info: any;

      try {
        // First try with the bundled yt-dlp
        info = await youtubedl(url, ytdlOptions);
      } catch (error: any) {
        console.log('Bundled yt-dlp failed, trying system yt-dlp...');

        // Fallback to system yt-dlp if available
        const cookiesArg = this.cookiesPath ? `--cookies "${this.cookiesPath}"` : '';
        const command = `yt-dlp "${url}" --dump-json --no-warnings --extractor-args "youtube:player_client=web" ${cookiesArg}`;

        try {
          const { stdout } = await execAsync(command);
          info = JSON.parse(stdout);
        } catch (fallbackError: any) {
          console.error('System yt-dlp also failed:', fallbackError.message);
          throw error; // Throw original error
        }
      }

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
      const ytdlOptions: any = {
        extractAudio: true,
        audioFormat: 'm4a',
        output: tempOutputPath,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        // Add user agent to avoid bot detection
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // Add referer
        referer: 'https://www.youtube.com/',
        // Sleep interval to avoid rate limiting
        sleepInterval: 1,
        maxSleepInterval: 3,
        // Use different extraction method to bypass restrictions
        extractorArgs: 'youtube:player_client=web',
        // Force IPv4
        forceIpv4: true
      };

      // Add cookies if available
      if (this.cookiesPath) {
        ytdlOptions.cookies = this.cookiesPath;
      } else if (this.browserCookies && process.platform !== 'linux') {
        // Use cookies from browser (only works on non-containerized environments)
        ytdlOptions.cookiesFromBrowser = this.browserCookies;
      }

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
