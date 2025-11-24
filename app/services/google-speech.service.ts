import { SpeechClient } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

export class GoogleSpeechService {
  private client: SpeechClient;
  private storage: Storage | null = null;
  private bucketName: string;

  constructor() {
    try {
      // Initialize the Speech client
      // The client will automatically use GOOGLE_APPLICATION_CREDENTIALS env variable
      this.client = new SpeechClient({
        projectId: serviceConfigs.googleCloudProjectId,
        keyFilename: serviceConfigs.googleApplicationCredentials
      });

      this.bucketName = serviceConfigs.gcsBucketName;

      // Initialize GCS storage for long audio files (>1 minute)
      try {
        this.storage = new Storage({
          projectId: serviceConfigs.googleCloudProjectId,
          keyFilename: serviceConfigs.googleApplicationCredentials
        });
        console.log('Google Cloud Speech-to-Text client initialized');
        console.log(`GCS Bucket configured: ${this.bucketName}`);
      } catch (storageError: any) {
        console.warn('GCS Storage initialization warning:', storageError.message);
        console.log('Note: Long audio files (>1 minute) require GCS storage');
      }
    } catch (error: any) {
      console.error('Error initializing Google Speech client:', error.message);
      throw new Error(`Failed to initialize Google Speech client: ${error.message}`);
    }
  }

  /**
   * Calculate audio duration in seconds from WAV file
   */
  private calculateWavDuration(audioFilePath: string): number {
    try {
      const stats = fs.statSync(audioFilePath);
      const fileSize = stats.size;

      // WAV file format: 16-bit PCM, mono, 16000 Hz sample rate
      // Formula: duration = (file_size - header_size) / (sample_rate * channels * bytes_per_sample)
      const headerSize = 44; // Standard WAV header size
      const sampleRate = serviceConfigs.audioSampleRate; // 16000 Hz
      const channels = serviceConfigs.audioChannels; // 1 (mono)
      const bytesPerSample = 2; // 16-bit = 2 bytes

      const audioDataSize = fileSize - headerSize;
      const duration = audioDataSize / (sampleRate * channels * bytesPerSample);

      return Math.ceil(duration);
    } catch (error) {
      console.warn('Could not calculate audio duration, assuming short file');
      return 0;
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

      // Get file size
      const fileSizeBytes = audioBytes.length;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);

      // Calculate audio duration
      const durationSeconds = this.calculateWavDuration(audioFilePath);

      console.log(`Audio file size: ${fileSizeMB.toFixed(2)} MB`);
      console.log(`Audio duration: ${durationSeconds} seconds`);

      // Google Speech-to-Text synchronous API limits:
      // - Duration: Max 60 seconds
      // - File size: Max 10MB
      // Use long-running operation for longer/larger files
      if (durationSeconds > 60 || fileSizeMB > 10) {
        console.log(`Audio exceeds sync limits (duration: ${durationSeconds}s, size: ${fileSizeMB.toFixed(2)}MB)`);
        console.log('Using long-running operation with GCS');
        return await this.transcribeLongRunning(audioFilePath, language);
      }

      const audioBase64 = audioBytes.toString('base64');

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
   * For audio files > 60 seconds or > 10MB
   */
  private async transcribeLongRunning(audioFilePath: string, language: string): Promise<string> {
    if (!this.storage) {
      throw new Error(
        'GCS Storage not initialized. Long audio files (>1 minute) require GCS storage. ' +
        'Please check GOOGLE_APPLICATION_CREDENTIALS and GCS_BUCKET_NAME configuration.'
      );
    }

    try {
      // Upload file to GCS
      const fileName = `audio-${Date.now()}-${path.basename(audioFilePath)}`;
      const gcsUri = `gs://${this.bucketName}/${fileName}`;

      console.log(`Uploading audio to GCS: ${gcsUri}`);

      const bucket = this.storage.bucket(this.bucketName);
      await bucket.upload(audioFilePath, {
        destination: fileName,
        metadata: {
          contentType: 'audio/wav'
        }
      });

      console.log('Upload completed, starting long-running transcription...');

      // Determine audio encoding
      const encoding = audioFilePath.endsWith('.wav')
        ? 'LINEAR16'
        : audioFilePath.endsWith('.flac')
          ? 'FLAC'
          : 'LINEAR16';

      const request: any = {
        audio: {
          uri: gcsUri
        },
        config: {
          encoding,
          sampleRateHertz: serviceConfigs.audioSampleRate,
          languageCode: language,
          enableAutomaticPunctuation: true,
          model: 'video', // Optimized for video content
          useEnhanced: true, // Use enhanced model for better accuracy
          audioChannelCount: serviceConfigs.audioChannels
        }
      };

      // Start long-running operation
      const [operation] = await this.client.longRunningRecognize(request);

      console.log('Waiting for transcription to complete...');

      // Wait for the operation to complete
      const [response] = await operation.promise();

      // Clean up: delete the file from GCS
      try {
        await bucket.file(fileName).delete();
        console.log('Cleaned up GCS file');
      } catch (cleanupError) {
        console.warn('Failed to clean up GCS file:', cleanupError);
      }

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
        .filter((text: string) => text.trim().length > 0)
        .join('\n');

      console.log(`Long-running transcription completed. Length: ${transcript.length} characters`);

      return transcript;

    } catch (error: any) {
      console.error('Error in long-running transcription:', error.message);

      // Provide specific error messages
      if (error.message.includes('bucket')) {
        throw new Error(
          `GCS Bucket error: ${error.message}. ` +
          `Please ensure bucket '${this.bucketName}' exists and has proper permissions.`
        );
      }

      throw new Error(`Long-running transcription failed: ${error.message}`);
    }
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
