import { Transcript, ITranscript } from '../models/transcript.model';
import { YouTubeDownloaderService } from './youtube-downloader.service';
import { AudioConverterService } from './audio-converter.service';
import { GoogleSpeechService } from './google-speech.service';
import { OpenAIWhisperService } from './openai-whisper.service';
import { serviceConfigs } from '../../config/global.config';
import mongoose from 'mongoose';

export class TranscriptionService {
  private youtubeDownloader: YouTubeDownloaderService;
  private audioConverter: AudioConverterService;
  private googleSpeech: GoogleSpeechService | null = null;
  private openaiWhisper: OpenAIWhisperService | null = null;

  constructor() {
    this.youtubeDownloader = new YouTubeDownloaderService();
    this.audioConverter = new AudioConverterService();

    // Initialize the appropriate transcription provider
    this.initializeProviders();
  }

  /**
   * Initialize transcription providers based on configuration
   */
  private initializeProviders(): void {
    const provider = serviceConfigs.transcriptionProvider;

    console.log(`Initializing transcription provider: ${provider}`);

    try {
      if (provider === 'google') {
        this.googleSpeech = new GoogleSpeechService();
      } else if (provider === 'openai') {
        this.openaiWhisper = new OpenAIWhisperService();
      } else {
        console.warn(`Unknown transcription provider: ${provider}. Defaulting to Google.`);
        this.googleSpeech = new GoogleSpeechService();
      }
    } catch (error: any) {
      console.error(`Failed to initialize ${provider} provider:`, error.message);
      throw error;
    }
  }

  /**
   * Start transcription process for a YouTube video
   * @param youtubeUrl YouTube video URL
   * @param language Language code (e.g., 'en-US')
   * @param questionId Optional question ID to link the transcript
   * @returns Transcript document ID
   */
  async startTranscription(
    youtubeUrl: string,
    language: string = serviceConfigs.defaultLanguage,
    questionId?: string
  ): Promise<string> {
    try {
      console.log(`Starting transcription for: ${youtubeUrl}`);

      // 1. Get video information
      const videoInfo = await this.youtubeDownloader.getVideoInfo(youtubeUrl);

      console.log(`Video: ${videoInfo.title}`);
      console.log(`Duration: ${videoInfo.duration}s`);

      // 2. Check if transcript already exists for this video
      const existing = await Transcript.findOne({
        videoId: videoInfo.videoId,
        status: { $in: ['completed', 'processing'] }
      });

      if (existing) {
        console.log(`Transcript already exists for video: ${videoInfo.videoId}`);

        if (existing.status === 'completed') {
          return existing._id.toString();
        } else {
          console.log('Transcript is still processing');
          return existing._id.toString();
        }
      }

      // 3. Create transcript document
      const transcript = await Transcript.create({
        youtubeUrl,
        videoId: videoInfo.videoId,
        videoTitle: videoInfo.title,
        videoDuration: videoInfo.duration,
        language,
        status: 'pending',
        progress: 0,
        provider: serviceConfigs.transcriptionProvider,
        questionId: questionId ? new mongoose.Types.ObjectId(questionId) : undefined,
        createdDate: new Date()
      });

      console.log(`Created transcript document: ${transcript._id}`);

      // 4. Start background processing (don't await)
      this.processTranscription(transcript._id.toString()).catch((error) => {
        console.error(`Error processing transcription ${transcript._id}:`, error);
      });

      return transcript._id.toString();

    } catch (error: any) {
      console.error('Error starting transcription:', error);
      throw new Error(`Failed to start transcription: ${error.message}`);
    }
  }

  /**
   * Process transcription (background task)
   */
  private async processTranscription(transcriptId: string): Promise<void> {
    let audioFilePath: string | null = null;
    let convertedAudioPath: string | null = null;

    try {
      console.log(`Processing transcription: ${transcriptId}`);

      // Get transcript document
      const transcript = await Transcript.findById(transcriptId);

      if (!transcript) {
        throw new Error(`Transcript not found: ${transcriptId}`);
      }

      // Update status to processing
      transcript.status = 'processing';
      transcript.progress = 10;
      await transcript.save();

      // 1. Download audio from YouTube
      console.log('Step 1: Downloading audio...');
      audioFilePath = await this.youtubeDownloader.downloadAudio(
        transcript.youtubeUrl,
        transcript.videoId
      );

      transcript.progress = 30;
      transcript.audioFilePath = audioFilePath;
      await transcript.save();

      // 2. Convert audio to speech-recognizable format
      console.log('Step 2: Converting audio format...');
      convertedAudioPath = await this.audioConverter.convertToSpeechFormat(audioFilePath);

      transcript.progress = 50;
      await transcript.save();

      // 3. Transcribe audio using the configured provider
      console.log('Step 3: Transcribing audio...');
      let transcriptText: string;

      if (serviceConfigs.transcriptionProvider === 'openai' && this.openaiWhisper) {
        transcriptText = await this.openaiWhisper.transcribe(convertedAudioPath, transcript.language);
      } else if (this.googleSpeech) {
        transcriptText = await this.googleSpeech.transcribe(convertedAudioPath, transcript.language);
      } else {
        throw new Error('No transcription provider available');
      }

      transcript.progress = 90;
      await transcript.save();

      // 4. Save transcript and update document
      const wordCount = transcriptText.split(/\s+/).length;

      transcript.transcript = transcriptText;
      transcript.wordCount = wordCount;
      transcript.status = 'completed';
      transcript.progress = 100;
      transcript.completedDate = new Date();
      await transcript.save();

      console.log(`✓ Transcription completed: ${transcriptId}`);
      console.log(`  Words: ${wordCount}`);
      console.log(`  Length: ${transcriptText.length} characters`);

    } catch (error: any) {
      console.error(`✗ Transcription failed: ${transcriptId}`, error);

      // Update transcript with error
      await Transcript.findByIdAndUpdate(transcriptId, {
        status: 'failed',
        errorMessage: error.message,
        progress: 0
      });

    } finally {
      // Cleanup temporary files
      if (serviceConfigs.cleanupTempFiles) {
        if (audioFilePath) {
          this.youtubeDownloader.deleteAudioFile(audioFilePath);
        }
        if (convertedAudioPath && convertedAudioPath !== audioFilePath) {
          this.youtubeDownloader.deleteAudioFile(convertedAudioPath);
        }
      }
    }
  }

  /**
   * Get transcription status
   */
  async getTranscriptionStatus(transcriptId: string): Promise<ITranscript | null> {
    try {
      const transcript = await Transcript.findById(transcriptId);
      return transcript;
    } catch (error: any) {
      console.error('Error getting transcription status:', error);
      return null;
    }
  }

  /**
   * Get transcript by ID
   */
  async getTranscript(transcriptId: string): Promise<ITranscript | null> {
    try {
      const transcript = await Transcript.findById(transcriptId);
      return transcript;
    } catch (error: any) {
      console.error('Error getting transcript:', error);
      return null;
    }
  }

  /**
   * Get transcripts by question ID
   */
  async getTranscriptsByQuestionId(questionId: string): Promise<ITranscript[]> {
    try {
      const transcripts = await Transcript.find({ questionId: new mongoose.Types.ObjectId(questionId) });
      return transcripts;
    } catch (error: any) {
      console.error('Error getting transcripts by question ID:', error);
      return [];
    }
  }

  /**
   * Delete transcript
   */
  async deleteTranscript(transcriptId: string): Promise<boolean> {
    try {
      const result = await Transcript.findByIdAndDelete(transcriptId);
      return !!result;
    } catch (error: any) {
      console.error('Error deleting transcript:', error);
      return false;
    }
  }

  /**
   * Clean up old temporary files
   */
  cleanupTempFiles(): void {
    this.youtubeDownloader.cleanupOldFiles();
  }
}
