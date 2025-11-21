import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

export class AudioConverterService {
  constructor() {
    // Configure ffmpeg path for Windows
    const ffmpegPath = 'C:\\Users\\Renato\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-essentials_build\\bin\\ffmpeg.exe';
    const ffprobePath = 'C:\\Users\\Renato\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-essentials_build\\bin\\ffprobe.exe';

    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);

    console.log('FFmpeg configured at:', ffmpegPath);
  }

  /**
   * Convert audio file to format suitable for speech recognition
   * @param inputPath Path to the input audio file (MP4, MP3, etc.)
   * @returns Path to the converted audio file (WAV or FLAC)
   */
  async convertToSpeechFormat(inputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const format = serviceConfigs.audioFormat; // 'wav' or 'flac'
        const outputPath = inputPath.replace(path.extname(inputPath), `.${format}`);

        console.log(`Converting audio: ${inputPath} -> ${outputPath}`);
        console.log(`Format: ${format}, Channels: ${serviceConfigs.audioChannels}, Sample Rate: ${serviceConfigs.audioSampleRate}Hz`);

        // Check if output file already exists
        if (fs.existsSync(outputPath)) {
          console.log(`Converted file already exists: ${outputPath}`);
          return resolve(outputPath);
        }

        const converter = ffmpeg(inputPath)
          .toFormat(format)
          .audioChannels(serviceConfigs.audioChannels) // Mono
          .audioFrequency(serviceConfigs.audioSampleRate) // 16kHz for speech recognition
          .audioBitrate('16k'); // Low bitrate sufficient for speech

        // Additional settings for WAV format
        if (format === 'wav') {
          converter.audioCodec('pcm_s16le'); // 16-bit PCM
        }

        converter
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Conversion progress: ${progress.percent.toFixed(2)}%`);
            }
          })
          .on('end', () => {
            console.log(`Audio conversion completed: ${outputPath}`);
            resolve(outputPath);
          })
          .on('error', (error, stdout, stderr) => {
            console.error('FFmpeg error:', error.message);
            console.error('FFmpeg stderr:', stderr);

            // Clean up partial output file
            if (fs.existsSync(outputPath)) {
              try {
                fs.unlinkSync(outputPath);
              } catch (e) {
                console.error('Error cleaning up partial file:', e);
              }
            }

            reject(new Error(`Failed to convert audio: ${error.message}`));
          })
          .save(outputPath);

      } catch (error: any) {
        console.error('Error in convertToSpeechFormat:', error);
        reject(error);
      }
    });
  }

  /**
   * Get audio duration in seconds
   */
  async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) {
          console.error('Error getting audio duration:', error);
          reject(error);
        } else {
          const duration = metadata.format.duration || 0;
          resolve(duration);
        }
      });
    });
  }

  /**
   * Get audio file size in bytes
   */
  getAudioFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error: any) {
      console.error('Error getting file size:', error.message);
      return 0;
    }
  }

  /**
   * Check if FFmpeg is available
   */
  async checkFFmpegAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((error, formats) => {
        if (error) {
          console.error('FFmpeg not available:', error.message);
          resolve(false);
        } else {
          console.log('FFmpeg is available');
          resolve(true);
        }
      });
    });
  }
}
