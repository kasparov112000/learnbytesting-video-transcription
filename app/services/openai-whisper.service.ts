import OpenAI from 'openai';
import * as fs from 'fs';
import { serviceConfigs } from '../../config/global.config';

export class OpenAIWhisperService {
  private client: OpenAI;

  constructor() {
    try {
      if (!serviceConfigs.openaiApiKey) {
        throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable');
      }

      this.client = new OpenAI({
        apiKey: serviceConfigs.openaiApiKey
      });

      console.log('OpenAI Whisper client initialized');
    } catch (error: any) {
      console.error('Error initializing OpenAI client:', error.message);
      throw new Error(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }

  /**
   * Transcribe audio file using OpenAI Whisper API
   * @param audioFilePath Path to the audio file
   * @param language Language code (e.g., 'en', 'es') - ISO-639-1 format
   * @returns Transcript text
   */
  async transcribe(audioFilePath: string, language: string = 'en'): Promise<string> {
    try {
      console.log(`Starting OpenAI Whisper transcription for: ${audioFilePath}`);

      // Convert language code from BCP-47 (en-US) to ISO-639-1 (en) if needed
      const isoLanguage = language.split('-')[0];
      console.log(`Language: ${isoLanguage}`);

      // Get file size
      const stats = fs.statSync(audioFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log(`Audio file size: ${fileSizeMB.toFixed(2)} MB`);

      // OpenAI Whisper API has a 25MB file size limit
      if (fileSizeMB > 25) {
        throw new Error(`Audio file size (${fileSizeMB.toFixed(2)}MB) exceeds OpenAI limit (25MB). Consider using Google Speech-to-Text instead.`);
      }

      // Read the audio file
      const audioFile = fs.createReadStream(audioFilePath);

      console.log('Sending transcription request to OpenAI Whisper API...');

      // Call OpenAI Whisper API
      const response = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: isoLanguage,
        response_format: 'text',
        temperature: 0.2 // Lower temperature for more consistent transcription
      });

      const transcript = response as unknown as string;

      console.log(`Transcription completed. Length: ${transcript.length} characters`);

      return transcript;

    } catch (error: any) {
      console.error('Error transcribing with OpenAI Whisper:', error.message);

      // Provide more specific error messages
      if (error.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check OPENAI_API_KEY environment variable');
      } else if (error.status === 413) {
        throw new Error('Audio file too large. OpenAI Whisper has a 25MB limit');
      } else if (error.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later');
      } else if (error.code === 'ENOENT') {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      throw new Error(`OpenAI Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe audio with detailed response including timestamps
   * @param audioFilePath Path to the audio file
   * @param language Language code
   * @returns Detailed transcription with segments and timestamps
   */
  async transcribeWithTimestamps(
    audioFilePath: string,
    language: string = 'en'
  ): Promise<{
    text: string;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }> {
    try {
      console.log(`Starting OpenAI Whisper transcription with timestamps...`);

      const isoLanguage = language.split('-')[0];
      const audioFile = fs.createReadStream(audioFilePath);

      const response = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: isoLanguage,
        response_format: 'verbose_json',
        temperature: 0.2,
        timestamp_granularities: ['segment']
      });

      console.log(`Transcription with timestamps completed`);

      return {
        text: response.text,
        segments: response.segments?.map((segment: any) => ({
          start: segment.start,
          end: segment.end,
          text: segment.text
        }))
      };

    } catch (error: any) {
      console.error('Error transcribing with timestamps:', error.message);
      throw new Error(`OpenAI Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Translate audio to English
   * @param audioFilePath Path to the audio file
   * @returns Translated transcript in English
   */
  async translate(audioFilePath: string): Promise<string> {
    try {
      console.log(`Starting OpenAI Whisper translation for: ${audioFilePath}`);

      const audioFile = fs.createReadStream(audioFilePath);

      const response = await this.client.audio.translations.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'text'
      });

      const translation = response as unknown as string;

      console.log(`Translation completed. Length: ${translation.length} characters`);

      return translation;

    } catch (error: any) {
      console.error('Error translating with OpenAI Whisper:', error.message);
      throw new Error(`OpenAI Whisper translation failed: ${error.message}`);
    }
  }

  /**
   * Test OpenAI API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing OpenAI Whisper API connection...');

      // Try to list models to test the connection
      await this.client.models.list();

      console.log('✓ OpenAI Whisper API connection successful');
      return true;

    } catch (error: any) {
      console.error('✗ OpenAI Whisper API connection failed:', error.message);
      return false;
    }
  }
}
