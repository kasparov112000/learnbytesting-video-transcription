import { SpeechClient } from '@google-cloud/speech';
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

export class GoogleSpeechService {
  private client: SpeechClient;
  private gcsStorage: any; // GCS storage for large files (optional)

  constructor() {
    try {
      // Initialize the Speech client
      // The client will automatically use GOOGLE_APPLICATION_CREDENTIALS env variable
      this.client = new SpeechClient({
        projectId: serviceConfigs.googleCloudProjectId,
        keyFilename: serviceConfigs.googleApplicationCredentials
      });

      // Note: GCS storage is only needed for files > 10MB
      // We've removed the dependency to make it optional
      console.log('Google Cloud Speech-to-Text client initialized');
      console.log('Note: Large file support (>10MB) requires GCS storage setup');
    } catch (error: any) {
      console.error('Error initializing Google Speech client:', error.message);
      throw new Error(`Failed to initialize Google Speech client: ${error.message}`);
    }
  }

  /**
   * Transcribe audio file using Google Cloud Speech-to-Text
   * @param audioFilePath Path to the audio file (WAV or FLAC)
   * @param language Language code (e.g., 'en-US', 'es-ES')
   * @returns Transcript text
   */
  async transcribe(audioFilePath: string, language: string = 'en-US'): Promise<string> {
    try {
      console.log(`Starting Google Cloud transcription for: ${audioFilePath}`);
      console.log(`Language: ${language}`);

      // Read the audio file
      const audioBytes = fs.readFileSync(audioFilePath);
      const audioBase64 = audioBytes.toString('base64');

      // Get file size
      const fileSizeBytes = audioBytes.length;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);

      console.log(`Audio file size: ${fileSizeMB.toFixed(2)} MB`);

      // For files larger than 10MB, use long-running operation
      if (fileSizeMB > 10) {
        console.log('Using long-running operation for large file');
        return await this.transcribeLongRunning(audioFilePath, language);
      }

      // Determine audio encoding based on file extension
      const encoding = audioFilePath.endsWith('.wav')
        ? 'LINEAR16'
        : audioFilePath.endsWith('.flac')
          ? 'FLAC'
          : 'LINEAR16';

      const request: any = {
        audio: {
          content: audioBase64
        },
        config: {
          encoding,
          sampleRateHertz: serviceConfigs.audioSampleRate,
          languageCode: language,
          enableAutomaticPunctuation: true,
          model: 'video', // Optimized for video content
          useEnhanced: true, // Use enhanced model for better accuracy
          audioChannelCount: serviceConfigs.audioChannels,
          enableWordTimeOffsets: false // Set to true if you need timestamps
        }
      };

      console.log('Sending transcription request to Google Cloud...');

      const [response] = await this.client.recognize(request);

      if (!response.results || response.results.length === 0) {
        console.warn('No transcription results returned');
        return '';
      }

      // Combine all transcription results
      const transcript = response.results
        .map((result: any) => {
          const alternative = result.alternatives?.[0];
          return alternative?.transcript || '';
        })
        .filter(text => text.trim().length > 0)
        .join('\n');

      console.log(`Transcription completed. Length: ${transcript.length} characters`);

      return transcript;

    } catch (error: any) {
      console.error('Error transcribing with Google Speech:', error.message);

      // Provide more specific error messages
      if (error.code === 3) {
        throw new Error('Invalid audio format. Please ensure the audio is in WAV or FLAC format');
      } else if (error.code === 7) {
        throw new Error('Permission denied. Please check Google Cloud credentials');
      } else if (error.code === 8) {
        throw new Error('Quota exceeded. Please check your Google Cloud Speech-to-Text quota');
      }

      throw new Error(`Google Speech transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe large audio files using long-running operation with GCS
   * Note: GCS storage setup required for files > 10MB
   */
  private async transcribeLongRunning(audioFilePath: string, language: string): Promise<string> {
    throw new Error(
      'Large file transcription (>10MB) requires GCS storage setup. ' +
      'Please use self-hosted Whisper for large files or set up GCS storage.'
    );
  }

  /**
   * Test Google Cloud Speech-to-Text connection
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing Google Cloud Speech-to-Text connection...');

      // Create a minimal request to test the connection
      const request: any = {
        audio: {
          content: Buffer.from([]).toString('base64') // Empty audio
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US'
        }
      };

      // This will fail but confirms we can connect to the API
      try {
        await this.client.recognize(request);
      } catch (error: any) {
        // We expect an error due to empty audio, but if we get this far, connection works
        if (error.code === 3) { // INVALID_ARGUMENT
          console.log('✓ Google Cloud Speech-to-Text connection successful');
          return true;
        }
        throw error;
      }

      return true;

    } catch (error: any) {
      console.error('✗ Google Cloud Speech-to-Text connection failed:', error.message);
      return false;
    }
  }
}
