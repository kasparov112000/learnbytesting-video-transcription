import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { serviceConfigs } from '../../config/global.config';

export class SelfHostedWhisperService {
  private whisperUrl: string;

  constructor() {
    // URL of your Whisper service (Python Flask, Docker, etc.)
    this.whisperUrl = serviceConfigs.whisperServiceUrl || 'http://localhost:5000';
    console.log(`✓ Self-hosted Whisper configured: ${this.whisperUrl}`);
  }

  /**
   * Transcribe audio file using self-hosted Whisper
   * @param audioFilePath Path to the audio file
   * @param language Language code (e.g., 'en-US', 'es-ES')
   * @returns Transcript text
   */
  async transcribe(audioFilePath: string, language: string = 'en-US'): Promise<string> {
    try {
      // Convert to absolute path if it's relative
      const absolutePath = path.isAbsolute(audioFilePath)
        ? audioFilePath
        : path.resolve(process.cwd(), audioFilePath);

      console.log(`Starting self-hosted Whisper transcription: ${absolutePath}`);
      console.log(`Language: ${language}`);

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Audio file not found: ${absolutePath}`);
      }

      // Get file size for logging
      const stats = fs.statSync(absolutePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`Audio file size: ${fileSizeMB.toFixed(2)} MB`);

      // Read file into buffer to avoid "file deleted while streaming" issues
      const audioBuffer = fs.readFileSync(absolutePath);
      console.log(`Read ${audioBuffer.length} bytes from audio file`);

      // Create form data with buffer instead of stream
      // Detect content type from file extension
      const ext = path.extname(absolutePath).toLowerCase();
      const contentTypeMap: Record<string, string> = {
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.mp4': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
        '.webm': 'audio/webm'
      };
      const contentType = contentTypeMap[ext] || 'audio/wav';
      const filename = `audio${ext}`;

      console.log(`Sending audio as: ${filename} (${contentType})`);

      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: filename,
        contentType: contentType
      });

      // Extract language code (e.g., 'en-US' -> 'en')
      const languageCode = language.split('-')[0];
      formData.append('language', languageCode);

      console.log('Sending transcription request to self-hosted Whisper service...');

      // Send request to Whisper service with very generous timeout
      const response = await axios.post(`${this.whisperUrl}/transcribe`, formData, {
        headers: formData.getHeaders(),
        timeout: 3600000, // 60 minutes timeout (for long videos on slow hardware)
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      if (!response.data || !response.data.transcript) {
        throw new Error('Invalid response from Whisper service');
      }

      const transcript = response.data.transcript;
      console.log(`✓ Self-hosted transcription completed: ${transcript.length} characters`);

      return transcript;

    } catch (error: any) {
      console.error('Self-hosted Whisper error:', error.message);

      // Provide more specific error messages
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to Whisper service at ${this.whisperUrl}. ` +
          'Please ensure the Whisper service is running.'
        );
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Whisper transcription timed out. The audio file may be too large.');
      } else if (error.response) {
        throw new Error(
          `Whisper service error (${error.response.status}): ` +
          (error.response.data?.error || error.message)
        );
      }

      throw new Error(`Self-hosted Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Test connection to self-hosted Whisper service
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing self-hosted Whisper connection...');

      const response = await axios.get(`${this.whisperUrl}/health`, {
        timeout: 5000
      });

      if (response.status === 200) {
        console.log('✓ Self-hosted Whisper connection successful');
        return true;
      }

      return false;

    } catch (error: any) {
      console.error('✗ Self-hosted Whisper connection failed:', error.message);
      console.error(`  Make sure the service is running at: ${this.whisperUrl}`);
      return false;
    }
  }
}
