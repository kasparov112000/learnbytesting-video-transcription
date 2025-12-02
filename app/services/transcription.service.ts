import { Transcript, ITranscript } from '../models/transcript.model';
import { PythonYouTubeDownloaderService } from './python-youtube-downloader.service';
import { YouTubeAPIService } from './youtube-api.service';
import { AudioConverterService } from './audio-converter.service';
import { GoogleSpeechService } from './google-speech.service';
import { OpenAIWhisperService } from './openai-whisper.service';
import { SelfHostedWhisperService } from './self-hosted-whisper.service';
import { MockTranscriptionService } from './mock-transcription.service';
import { serviceConfigs } from '../../config/global.config';
import mongoose from 'mongoose';

export class TranscriptionService {
  private youtubeDownloader: PythonYouTubeDownloaderService;
  private youtubeApi: YouTubeAPIService | null = null;
  private audioConverter: AudioConverterService;
  private googleSpeech: GoogleSpeechService | null = null;
  private openaiWhisper: OpenAIWhisperService | null = null;
  private selfHostedWhisper: SelfHostedWhisperService | null = null;
  private mockTranscription: MockTranscriptionService | null = null;

  constructor() {
    this.youtubeDownloader = new PythonYouTubeDownloaderService();
    this.audioConverter = new AudioConverterService();

    // Initialize YouTube API service if API key is configured
    if (serviceConfigs.youtubeApiKey) {
      console.log('✓ YouTube Data API v3 enabled - will try captions first');
      this.youtubeApi = new YouTubeAPIService();
    } else {
      console.log('⚠️  YouTube Data API v3 not configured - will use audio download only');
    }

    // Initialize the appropriate transcription provider
    this.initializeProviders();
  }

  /**
   * Initialize transcription providers based on configuration
   */
  private initializeProviders(): void {
    // Check if mock mode is enabled
    if (serviceConfigs.useMockTranscription) {
      console.log('🎭 Initializing MOCK transcription provider (no API charges)');
      this.mockTranscription = new MockTranscriptionService();
      return;
    }

    const provider = serviceConfigs.transcriptionProvider;
    console.log(`Initializing transcription provider: ${provider}`);

    try {
      if (provider === 'self-hosted') {
        console.log('🚀 Using SELF-HOSTED Whisper (95% cost savings!)');
        this.selfHostedWhisper = new SelfHostedWhisperService();
      } else if (provider === 'google') {
        this.googleSpeech = new GoogleSpeechService();
      } else if (provider === 'openai') {
        this.openaiWhisper = new OpenAIWhisperService();
      } else if (provider === 'mock') {
        console.log('🎭 Using MOCK transcription provider (no API charges)');
        this.mockTranscription = new MockTranscriptionService();
      } else {
        console.warn(`Unknown transcription provider: ${provider}. Defaulting to self-hosted Whisper.`);
        this.selfHostedWhisper = new SelfHostedWhisperService();
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

      // Check if we're using mock mode
      const useMock = serviceConfigs.useMockTranscription || serviceConfigs.transcriptionProvider === 'mock';

      // 1. Get video information (or use mock data)
      let videoInfo;
      if (useMock) {
        console.log('🎭 MOCK MODE: Using mock video info (no YouTube API calls)');
        // Extract video ID from URL or generate a mock one
        const videoIdMatch = youtubeUrl.match(/[?&]v=([^&]+)/);
        videoInfo = {
          videoId: videoIdMatch ? videoIdMatch[1] : 'mock-' + Date.now(),
          title: 'Mock Video - ' + new Date().toISOString(),
          duration: 300, // 5 minutes mock duration
          thumbnail: 'https://via.placeholder.com/480x360?text=Mock+Video'
        };
      } else if (this.youtubeApi) {
        // Try YouTube API first (no bot detection!)
        console.log('🎬 Using YouTube Data API v3 to get video info...');
        try {
          videoInfo = await this.youtubeApi.getVideoInfo(youtubeUrl);
          console.log(`✓ Video info retrieved from YouTube API`);
        } catch (error: any) {
          console.warn(`YouTube API failed: ${error.message}`);
          // In manual_download mode, don't fall back to Python downloader - we only need video info
          const isManualDownload = serviceConfigs.transcriptionWorkflow === 'manual_download';
          if (isManualDownload) {
            throw new Error(`YouTube API failed to get video info: ${error.message}. Please check YOUTUBE_API_KEY is configured.`);
          }
          console.log('Falling back to yt-dlp for video info...');
          videoInfo = await this.youtubeDownloader.getVideoInfo(youtubeUrl);
        }
      } else {
        // No YouTube API configured
        const isManualDownload = serviceConfigs.transcriptionWorkflow === 'manual_download';
        if (isManualDownload) {
          throw new Error('YouTube API is required for manual_download mode. Please set YOUTUBE_API_KEY environment variable.');
        }
        videoInfo = await this.youtubeDownloader.getVideoInfo(youtubeUrl);
      }

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

      // Check if we're in manual download workflow mode
      // Manual download mode works independently of mock mode:
      // - mock=true + manual_download: Use mock video info, status=pending_download
      // - mock=false + manual_download: Fetch real video info from YouTube, status=pending_download
      // - mock=false + auto: Fetch real video info, auto-process transcription
      const isManualDownloadMode = serviceConfigs.transcriptionWorkflow === 'manual_download';
      const initialStatus = isManualDownloadMode ? 'pending_download' : 'pending';

      // 3. Create transcript document
      const transcript = await Transcript.create({
        youtubeUrl,
        videoId: videoInfo.videoId,
        videoTitle: videoInfo.title,
        videoDuration: videoInfo.duration,
        language,
        status: initialStatus,
        progress: 0,
        provider: serviceConfigs.transcriptionProvider,
        questionId: questionId ? new mongoose.Types.ObjectId(questionId) : undefined,
        createdDate: new Date()
      });

      console.log(`Created transcript document: ${transcript._id}`);
      console.log(`  Status: ${initialStatus}`);

      // 4. Handle based on workflow mode
      if (isManualDownloadMode) {
        // Manual download mode: Don't process automatically
        // The user will download the video manually on their phone
        // android-sync will sync the downloaded audio file
        // A separate endpoint will be used to trigger transcription once audio is available
        console.log('📱 MANUAL DOWNLOAD MODE: Record created, waiting for audio to be synced via android-sync');
        console.log(`  Video ID: ${videoInfo.videoId}`);
        console.log(`  Title: ${videoInfo.title}`);
        console.log('  Next steps:');
        console.log('    1. Download video on Android phone');
        console.log('    2. android-sync will sync the audio file');
        console.log('    3. Call /transcription/process/:id to transcribe');
      } else {
        // Auto mode: Start background processing (don't await)
        this.processTranscription(transcript._id.toString()).catch((error) => {
          console.error(`Error processing transcription ${transcript._id}:`, error);
        });
      }

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

      // Check if we're using mock transcription (skip download for faster testing)
      const useMock = serviceConfigs.useMockTranscription || serviceConfigs.transcriptionProvider === 'mock';

      // Try to get captions from YouTube API first (fastest and cheapest!)
      let captionText: string | null = null;
      if (!useMock && this.youtubeApi) {
        console.log('🎬 Step 1: Trying to fetch captions from YouTube API...');
        captionText = await this.youtubeApi.downloadCaptions(transcript.youtubeUrl);

        if (captionText) {
          console.log('✓ Captions found! Converting SRT to plain text...');
          const plainText = this.youtubeApi.convertSRTToPlainText(captionText);

          if (plainText && plainText.length > 0) {
            // We have captions! Save and complete
            const wordCount = plainText.split(/\s+/).length;
            transcript.transcript = plainText;
            transcript.wordCount = wordCount;
            transcript.status = 'completed';
            transcript.progress = 100;
            transcript.completedDate = new Date();
            transcript.provider = 'youtube-api-captions';
            await transcript.save();

            console.log(`✓ Transcription completed using captions: ${transcriptId}`);
            console.log(`  Words: ${wordCount}`);
            console.log(`  Length: ${plainText.length} characters`);
            return; // Early return - no need to download audio!
          }
        } else {
          console.log('⚠️  No captions available - falling back to audio download');
        }
      }

      if (useMock) {
        console.log('🎭 MOCK MODE: Skipping YouTube download and audio conversion');
        transcript.progress = 50;
        await transcript.save();
      } else {
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
      }

      // 3. Transcribe audio using the configured provider
      console.log('Step 3: Transcribing audio...');
      let transcriptText: string;

      if (serviceConfigs.useMockTranscription && this.mockTranscription) {
        // Use mock transcription (no API charges)
        transcriptText = await this.mockTranscription.transcribe(convertedAudioPath || 'mock-audio.m4a', transcript.language);
      } else if (serviceConfigs.transcriptionProvider === 'self-hosted' && this.selfHostedWhisper) {
        transcriptText = await this.selfHostedWhisper.transcribe(convertedAudioPath, transcript.language);
      } else if (serviceConfigs.transcriptionProvider === 'openai' && this.openaiWhisper) {
        transcriptText = await this.openaiWhisper.transcribe(convertedAudioPath, transcript.language);
      } else if (serviceConfigs.transcriptionProvider === 'mock' && this.mockTranscription) {
        // Alternative way to enable mock
        transcriptText = await this.mockTranscription.transcribe(convertedAudioPath || 'mock-audio.m4a', transcript.language);
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

      // Auto-create a question with the transcript (no chess moves - user will add later)
      await this.autoCreateQuestion(transcript);

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

  /**
   * Get all transcripts with pending_download status
   * Used by jobs service to poll for records that need audio files
   */
  async getPendingDownloads(): Promise<ITranscript[]> {
    try {
      const transcripts = await Transcript.find({ status: 'pending_download' }).sort({ createdDate: 1 });
      return transcripts;
    } catch (error: any) {
      console.error('Error getting pending downloads:', error);
      return [];
    }
  }

  /**
   * Process a transcript with provided audio file
   * Called when audio file is available from android-sync
   */
  async processWithAudioFile(transcriptId: string, audioFilePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Processing transcript ${transcriptId} with audio file: ${audioFilePath}`);

      // Get transcript document
      const transcript = await Transcript.findById(transcriptId);

      if (!transcript) {
        return { success: false, error: 'Transcript not found' };
      }

      if (transcript.status !== 'pending_download') {
        return { success: false, error: `Transcript is not in pending_download status (current: ${transcript.status})` };
      }

      // Update status to processing
      transcript.status = 'processing';
      transcript.progress = 10;
      transcript.audioFilePath = audioFilePath;
      await transcript.save();

      // Start background processing
      this.processTranscriptionWithFile(transcriptId, audioFilePath).catch((error) => {
        console.error(`Error processing transcription ${transcriptId}:`, error);
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error processing with audio file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process transcription with a provided audio file (background task)
   */
  private async processTranscriptionWithFile(transcriptId: string, audioFilePath: string): Promise<void> {
    let convertedAudioPath: string | null = null;

    try {
      console.log(`Processing transcription with file: ${transcriptId}`);

      // Get transcript document
      const transcript = await Transcript.findById(transcriptId);

      if (!transcript) {
        throw new Error(`Transcript not found: ${transcriptId}`);
      }

      // Convert audio to speech-recognizable format
      console.log('Step 1: Converting audio format...');
      convertedAudioPath = await this.audioConverter.convertToSpeechFormat(audioFilePath);

      transcript.progress = 50;
      await transcript.save();

      // Transcribe audio using the configured provider
      console.log('Step 2: Transcribing audio...');
      let transcriptText: string;

      if (serviceConfigs.transcriptionProvider === 'self-hosted' && this.selfHostedWhisper) {
        transcriptText = await this.selfHostedWhisper.transcribe(convertedAudioPath, transcript.language);
      } else if (serviceConfigs.transcriptionProvider === 'openai' && this.openaiWhisper) {
        transcriptText = await this.openaiWhisper.transcribe(convertedAudioPath, transcript.language);
      } else if (this.googleSpeech) {
        transcriptText = await this.googleSpeech.transcribe(convertedAudioPath, transcript.language);
      } else {
        throw new Error('No transcription provider available');
      }

      transcript.progress = 90;
      await transcript.save();

      // Save transcript and update document
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

      // Auto-create a question with the transcript
      await this.autoCreateQuestion(transcript);

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
      if (serviceConfigs.cleanupTempFiles && convertedAudioPath && convertedAudioPath !== audioFilePath) {
        this.youtubeDownloader.deleteAudioFile(convertedAudioPath);
      }
    }
  }

  /**
   * Auto-create a question with the transcript (no chess moves)
   * This is called when transcription completes to automatically create a question
   * that the user can later add chess moves to.
   */
  private async autoCreateQuestion(transcript: ITranscript): Promise<void> {
    try {
      console.log(`📝 Auto-creating question for transcript: ${transcript._id}`);
      console.log(`  Video: ${transcript.videoTitle}`);
      console.log(`  Words: ${transcript.wordCount}`);

      // Build the question payload - a simple question with just the transcript
      const questionPayload = {
        name: transcript.videoTitle || 'Video Transcript',
        questionText: `Video transcript from: ${transcript.videoTitle}`,
        questionType: 'chess-video-transcript', // Create chess-video-transcript question type for video-based questions
        videoTranscript: transcript.transcript,
        youtubeUrl: transcript.youtubeUrl,
        videoId: transcript.videoId,
        transcriptId: transcript._id?.toString(),
        // Default category for chess - user can change later
        category: [{
          _id: 'chess-openings',
          name: 'Chess Openings',
          displayName: 'Chess > Chess Openings'
        }],
        // Empty answers - user will add chess moves later
        answers: [{
          answerText: '',
          isCorrect: true,
          moves: [],
          initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          initialPgn: '',
          solutionPgn: ''
        }],
        createdDate: new Date(),
        createdFrom: 'auto-transcription',
        status: 'transcript-only' // Mark as needing chess moves
      };

      // Call the questions service directly
      const questionsUrl = `${serviceConfigs.questionsServiceUrl}/questions`;
      console.log(`  Calling questions service: POST ${questionsUrl}`);

      const axios = require('axios');
      const response = await axios.post(questionsUrl, questionPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      if (response.status === 200 || response.status === 201) {
        const questionId = response.data?._id || response.data?.id;
        console.log(`✅ Question created successfully: ${questionId}`);

        // Update transcript with the linked question ID
        transcript.questionId = new mongoose.Types.ObjectId(questionId);
        await transcript.save();
        console.log(`  Linked question ${questionId} to transcript ${transcript._id}`);
      } else {
        console.error(`❌ Failed to create question: HTTP ${response.status}`);
        console.error('  Response:', response.data);
      }

    } catch (error: any) {
      console.error(`❌ Error auto-creating question:`, error.message);
      if (error.response) {
        console.error('  Status:', error.response.status);
        console.error('  Data:', error.response.data);
      }
      // Don't throw - we don't want to fail the transcription just because question creation failed
      // The transcript is still saved and the user can create a question manually
    }
  }
}
