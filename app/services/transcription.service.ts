import { ITranscript, getTranscriptModelForRequest } from '../models/transcript.model';
import { PythonYouTubeDownloaderService } from './python-youtube-downloader.service';
import { YouTubeAPIService } from './youtube-api.service';
import { AudioConverterService } from './audio-converter.service';
import { GoogleSpeechService } from './google-speech.service';
import { OpenAIWhisperService } from './openai-whisper.service';
import { SelfHostedWhisperService } from './self-hosted-whisper.service';
import { MockTranscriptionService } from './mock-transcription.service';
import { serviceConfigs } from '../../config/global.config';
import { databaseService } from './database.service';
import { auditLogService } from './audit-log.service';
import mongoose from 'mongoose';
import { has, isEmpty, isEqual, trim } from 'lodash';
import moment from 'moment';

// Define interface for sort model items (matches ag-grid)
interface GridSortItem {
  colId: string;
  sort: 'asc' | 'desc';
}

// Grid request interface matching ag-grid IServerSideGetRowsRequest
interface GridServerSideRowRequest {
  startRow?: number;
  endRow?: number;
  sortModel?: GridSortItem[];
  filterModel?: Record<string, any>;
  search?: {
    search?: string;
  };
  userContext?: {
    userGuid?: string;
    userEmail?: string;
    isAdmin?: boolean;
    roles?: string[];
  };
}

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
   * @param req Optional Express request object - used to determine which database to use
   * @returns Transcript document ID
   */
  async startTranscription(
    youtubeUrl: string,
    language: string = serviceConfigs.defaultLanguage,
    questionId?: string,
    req?: any
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
      // Use appropriate connection based on request origin
      const TranscriptModel = getTranscriptModelForRequest(req);
      const existing = await TranscriptModel.findOne({
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
      // Ensure videoTitle is never empty - use fallback chain
      const videoTitle = videoInfo.title && videoInfo.title.trim()
        ? videoInfo.title.trim()
        : `Video ${videoInfo.videoId || 'Unknown'}`;

      // Extract user context for createdByGuid
      const userContext = req?.body?.userContext;
      const createdByGuid = userContext?.userGuid;
      console.log('Creating transcript with createdByGuid:', createdByGuid || 'not provided');

      const transcript = await TranscriptModel.create({
        youtubeUrl,
        videoId: videoInfo.videoId,
        videoTitle: videoTitle,
        videoDuration: videoInfo.duration,
        language,
        status: initialStatus,
        progress: 0,
        provider: serviceConfigs.transcriptionProvider,
        questionId: questionId ? new mongoose.Types.ObjectId(questionId) : undefined,
        createdDate: new Date(),
        createdByGuid: createdByGuid || undefined
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
   * Start transcription from an uploaded audio file
   * Used by the wizard when uploading a file or recording from YouTube
   *
   * @param audioFilePath Path to the uploaded audio file
   * @param options Transcription options
   * @param req Express request object for database selection
   * @returns Transcript document ID
   */
  async startTranscriptionFromUpload(
    audioFilePath: string,
    options: {
      language?: string;
      videoTitle?: string;
      youtubeVideoId?: string;
      youtubeUrl?: string;
      categoryId?: string;
      category?: any;
      videoDuration?: number | null;
      originalFilename?: string;
      mimeType?: string;
      fileSize?: number;
    },
    req?: any
  ): Promise<string> {
    try {
      console.log(`Starting transcription from uploaded file: ${audioFilePath}`);

      // Get user context from request - parse if it's a JSON string (from multipart form)
      let userContext = req?.body?.userContext;
      if (typeof userContext === 'string') {
        try {
          userContext = JSON.parse(userContext);
        } catch (e) {
          console.warn('Failed to parse userContext:', e);
          userContext = {};
        }
      }
      const createdByGuid = userContext?.userGuid;
      const createdByEmail = userContext?.userEmail;

      // Determine request source (environment)
      const isProductionSource = req && databaseService.isProductionRequest(req);
      const requestSource = isProductionSource ? 'production' : 'local';

      console.log('Creating transcript with:');
      console.log('  createdByGuid:', createdByGuid || 'not provided');
      console.log('  createdByEmail:', createdByEmail || 'not provided');
      console.log('  requestSource:', requestSource);
      console.log('  videoTitle:', options.videoTitle);
      console.log('  youtubeVideoId:', options.youtubeVideoId);
      console.log('  categoryId:', options.categoryId);

      // Get the appropriate model based on request
      const TranscriptModel = getTranscriptModelForRequest(req);

      // Determine video title
      const videoTitle = options.videoTitle ||
        options.originalFilename ||
        `Uploaded Audio - ${new Date().toISOString()}`;

      // Create transcript document
      const transcript = await TranscriptModel.create({
        youtubeUrl: options.youtubeUrl || null,
        videoId: options.youtubeVideoId || null,
        videoTitle: videoTitle,
        videoDuration: options.videoDuration || null,
        language: options.language || serviceConfigs.defaultLanguage,
        status: 'processing',
        progress: 10,
        provider: serviceConfigs.transcriptionProvider,
        categoryId: options.categoryId || undefined,
        category: options.category || undefined,
        audioFilePath: audioFilePath,
        createdDate: new Date(),
        createdByGuid: createdByGuid || undefined,
        createdByEmail: createdByEmail || undefined,
        requestSource: requestSource,
        originalFilename: options.originalFilename,
        mimeType: options.mimeType,
        fileSize: options.fileSize,
        sourceType: options.youtubeVideoId ? 'youtube-recording' : 'file-upload'
      });

      console.log(`Created transcript document: ${transcript._id}`);

      // Start background processing
      this.processTranscriptionWithFile(transcript._id.toString(), audioFilePath, req).catch((error) => {
        console.error(`Error processing transcription ${transcript._id}:`, error);
      });

      return transcript._id.toString();

    } catch (error: any) {
      console.error('Error starting transcription from upload:', error);
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

      // Get transcript document using local connection
      const TranscriptModel = getTranscriptModelForRequest();
      const transcript = await TranscriptModel.findById(transcriptId);

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
      let transcriptionResult: { transcript: string; processing_time: number; language?: string; duration?: number };

      if (serviceConfigs.useMockTranscription && this.mockTranscription) {
        // Use mock transcription (no API charges)
        transcriptionResult = {
          transcript: await this.mockTranscription.transcribe(convertedAudioPath || 'mock-audio.m4a', transcript.language),
          processing_time: 0 // Mock transcription is instantaneous
        };
      } else if (serviceConfigs.transcriptionProvider === 'self-hosted' && this.selfHostedWhisper) {
        transcriptionResult = await this.selfHostedWhisper.transcribe(convertedAudioPath, transcript.language);
      } else if (serviceConfigs.transcriptionProvider === 'openai' && this.openaiWhisper) {
        // OpenAI Whisper returns just the transcript string
        const startTime = Date.now();
        const transcriptText = await this.openaiWhisper.transcribe(convertedAudioPath, transcript.language);
        transcriptionResult = {
          transcript: transcriptText,
          processing_time: (Date.now() - startTime) / 1000
        };
      } else if (serviceConfigs.transcriptionProvider === 'mock' && this.mockTranscription) {
        // Alternative way to enable mock
        transcriptionResult = {
          transcript: await this.mockTranscription.transcribe(convertedAudioPath || 'mock-audio.m4a', transcript.language),
          processing_time: 0 // Mock transcription is instantaneous
        };
      } else if (this.googleSpeech) {
        // Google Speech returns just the transcript string
        const startTime = Date.now();
        const transcriptText = await this.googleSpeech.transcribe(convertedAudioPath, transcript.language);
        transcriptionResult = {
          transcript: transcriptText,
          processing_time: (Date.now() - startTime) / 1000
        };
      } else {
        throw new Error('No transcription provider available');
      }

      const transcriptText = transcriptionResult.transcript;
      console.log(`✓ Transcription by ${serviceConfigs.transcriptionProvider} completed in ${transcriptionResult.processing_time.toFixed(2)}s`);

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
      const TranscriptModelForError = getTranscriptModelForRequest();
      await TranscriptModelForError.findByIdAndUpdate(transcriptId, {
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
  async getTranscriptionStatus(transcriptId: string, req?: any): Promise<ITranscript | null> {
    try {
      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcript = await TranscriptModel.findById(transcriptId);
      return transcript;
    } catch (error: any) {
      console.error('Error getting transcription status:', error);
      return null;
    }
  }

  /**
   * Get transcript by ID
   */
  async getTranscript(transcriptId: string, req?: any): Promise<ITranscript | null> {
    try {
      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcript = await TranscriptModel.findById(transcriptId);
      return transcript;
    } catch (error: any) {
      console.error('Error getting transcript:', error);
      return null;
    }
  }

  /**
   * Get transcripts by question ID
   */
  async getTranscriptsByQuestionId(questionId: string, req?: any): Promise<ITranscript[]> {
    try {
      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcripts = await TranscriptModel.find({ questionId: new mongoose.Types.ObjectId(questionId) });
      return transcripts;
    } catch (error: any) {
      console.error('Error getting transcripts by question ID:', error);
      return [];
    }
  }

  /**
   * Delete transcript
   */
  async deleteTranscript(transcriptId: string, req?: any): Promise<boolean> {
    try {
      const TranscriptModel = getTranscriptModelForRequest(req);
      const result = await TranscriptModel.findByIdAndDelete(transcriptId);
      return !!result;
    } catch (error: any) {
      console.error('Error deleting transcript:', error);
      return false;
    }
  }

  /**
   * Get all transcripts with pagination and filtering
   */
  async getAll(req?: any, params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ transcriptions: ITranscript[]; total: number }> {
    try {
      const TranscriptModel = getTranscriptModelForRequest(req);

      const page = params?.page || 1;
      const pageSize = params?.pageSize || 20;
      const skip = (page - 1) * pageSize;

      // Build query filter
      const filter: any = {};
      if (params?.status) {
        filter.status = params.status;
      }

      // Build sort
      const sortField = params?.sortBy || 'createdDate';
      const sortOrder = params?.sortOrder === 'asc' ? 1 : -1;
      const sort: any = { [sortField]: sortOrder };

      const [transcriptions, total] = await Promise.all([
        TranscriptModel.find(filter).sort(sort).skip(skip).limit(pageSize),
        TranscriptModel.countDocuments(filter)
      ]);

      return { transcriptions, total };
    } catch (error: any) {
      console.error('Error getting all transcripts:', error);
      return { transcriptions: [], total: 0 };
    }
  }

  /**
   * Get transcripts for ag-grid with server-side pagination using MongoDB aggregation pipeline.
   * Supports sorting, filtering, and pagination from ag-grid requests.
   *
   * Uses aggregation pipeline pattern from category.service.ts for better performance:
   * - $match for filtering
   * - $sort for ordering
   * - $group and $project for efficient pagination with total count in single query
   */
  async getGrid(req?: any, gridRequest?: GridServerSideRowRequest): Promise<{ rows: any[]; lastRow: number; isAdmin?: boolean }> {
    try {
      console.log('[GRID-AGG] Starting grid aggregation pipeline');
      console.log('[GRID-AGG] Request params:', JSON.stringify(gridRequest, null, 2));

      const TranscriptModel = getTranscriptModelForRequest(req);

      const start = parseInt(gridRequest?.startRow?.toString() || '0', 10);
      const pageSize = gridRequest?.endRow && gridRequest?.startRow
        ? gridRequest.endRow - gridRequest.startRow
        : 20;

      // Extract user context for filtering
      const userContext = gridRequest?.userContext;
      const userGuid = userContext?.userGuid;
      const userEmail = userContext?.userEmail;
      const isAdmin = userContext?.isAdmin || false;

      console.log('[GRID-AGG] User GUID:', userGuid);
      console.log('[GRID-AGG] User Email:', userEmail);
      console.log('[GRID-AGG] Is Admin:', isAdmin);

      // Build owner filter for non-admin users (applies in ALL environments)
      // Only admin users can see all records
      let ownerFilter: any = null;
      if (!isAdmin) {
        if (userGuid || userEmail) {
          const ownerConditions: any[] = [];
          if (userGuid) {
            ownerConditions.push({ createdByGuid: userGuid });
          }
          if (userEmail) {
            ownerConditions.push({ createdByEmail: userEmail });
          }
          ownerFilter = { $or: ownerConditions };
          console.log('[GRID-AGG] Filtering by owner - GUID:', userGuid, 'Email:', userEmail);
        } else {
          console.log('[GRID-AGG] No user identifier - showing no records');
          return { rows: [], lastRow: 0, isAdmin };
        }
      } else {
        console.log('[GRID-AGG] Admin user - showing all records');
      }

      // Build sort order
      let sort = this.getSortOrder(gridRequest);

      // Handle special sort cases (e.g., boolean fields)
      if (gridRequest?.sortModel?.[0]?.colId === 'isCompleted') {
        const isCompleted = gridRequest.sortModel[0].sort === 'asc';
        sort = { status: isCompleted ? 1 : -1 };
      }

      // Build filter from ag-grid filterModel
      const query = this.getGridFilter(gridRequest);

      // Build final match query combining all filters
      const matchQuery: any = {};
      const andConditions: any[] = [];

      if (Object.keys(query).length > 0) {
        andConditions.push(query);
      }

      if (ownerFilter) {
        andConditions.push(ownerFilter);
      }

      // Handle global search - searches across multiple fields
      if (gridRequest?.search?.search) {
        const searchText = trim(gridRequest.search.search);
        if (searchText) {
          const searchRegex = { $regex: this.escapeRegex(searchText), $options: 'i' };
          andConditions.push({
            $or: [
              { videoTitle: searchRegex },
              { youtubeUrl: searchRegex },
              { videoId: searchRegex },
              { status: searchRegex },
              { transcript: searchRegex },
              { 'category.name': searchRegex },
              { 'category.displayName': searchRegex },
              { language: searchRegex }
            ]
          });
          console.log('[GRID-AGG] Global search applied for:', searchText);
        }
      }

      // Combine conditions
      if (andConditions.length > 1) {
        Object.assign(matchQuery, { $and: andConditions });
      } else if (andConditions.length === 1) {
        Object.assign(matchQuery, andConditions[0]);
      }

      console.log('[GRID-AGG] Match query:', JSON.stringify(matchQuery));
      console.log('[GRID-AGG] Sort:', JSON.stringify(sort));

      // Build aggregation pipeline
      const aggregate: any[] = [
        { $match: matchQuery }
      ];

      // Add sort stage if we have sort criteria
      if (!isEmpty(sort)) {
        aggregate.push({ $sort: sort });
      }

      // Group all documents and calculate total count, then slice for pagination
      aggregate.push(
        {
          $group: {
            _id: null,
            rows: { $push: '$$ROOT' },
            lastRow: { $sum: 1 }
          }
        },
        {
          $project: {
            lastRow: 1,
            rows: {
              $slice: ['$rows', start, pageSize]
            }
          }
        }
      );

      console.log('[GRID-AGG] Running aggregation pipeline...');
      const results = await TranscriptModel.aggregate(aggregate);
      const response = results[0] || { rows: [], lastRow: 0 };

      console.log('[GRID-AGG] Results: rows=', response.rows?.length, 'lastRow=', response.lastRow);

      // Define admin-only fields that should be hidden from regular users
      const adminOnlyFields = ['provider', 'createdByGuid', 'createdByEmail'];

      // Strip admin-only fields for non-admin users
      let processedRows: any[] = response.rows || [];
      if (!isAdmin) {
        console.log('[GRID-AGG] Stripping admin-only fields for non-admin user');
        processedRows = processedRows.map(row => {
          const rowObj = { ...row };
          adminOnlyFields.forEach(field => {
            delete rowObj[field];
          });
          return rowObj;
        });
      }

      return { rows: processedRows, lastRow: response.lastRow, isAdmin };
    } catch (error: any) {
      console.error('[GRID-AGG] Error getting grid data:', error);
      return { rows: [], lastRow: 0 };
    }
  }

  /**
   * Helper method to get sort order from grid request
   */
  private getSortOrder(params?: GridServerSideRowRequest): Record<string, number> {
    const shouldSort = params?.sortModel && params.sortModel.length > 0;

    if (!shouldSort) {
      return { createdDate: -1 }; // Default sort by createdDate descending
    }

    const { colId, sort } = params!.sortModel![0];
    let key: string;

    // Map field names to their nested paths if needed
    switch (colId) {
      case 'category':
        key = 'category.name';
        break;
      case 'createdBy':
        key = 'createdByEmail';
        break;
      default:
        key = colId;
        break;
    }

    return { [key]: sort === 'desc' ? -1 : 1 };
  }

  /**
   * Build MongoDB query filter from ag-grid filterModel
   */
  private getGridFilter(params?: GridServerSideRowRequest): Record<string, any> {
    let query: any = {};
    const queries: any[] = [];

    if (!params?.filterModel) {
      return query;
    }

    const entries = Object.entries(params.filterModel);
    for (const [key, value] of entries) {
      const filterValue = value as any;
      const operator = filterValue.operator === 'AND' ? '$and'
                     : filterValue.operator === 'OR' ? '$or'
                     : undefined;

      let fieldKey = this.convertFieldToKey(key);
      let filter: any;

      switch (filterValue.filterType) {
        case 'number': {
          if (operator) {
            filter = {
              [operator]: [
                { [fieldKey]: this.getNumberFilter(filterValue.condition1) },
                { [fieldKey]: this.getNumberFilter(filterValue.condition2) }
              ]
            };
          } else {
            filter = { [fieldKey]: this.getNumberFilter(filterValue) };
          }
          break;
        }
        case 'text': {
          if (operator) {
            filter = {
              [operator]: [
                { [fieldKey]: this.getTextFilter(filterValue.condition1) },
                { [fieldKey]: this.getTextFilter(filterValue.condition2) }
              ]
            };
          } else {
            filter = { [fieldKey]: this.getTextFilter(filterValue) };
          }
          break;
        }
        case 'date': {
          if (operator) {
            filter = {
              [operator]: [
                { [fieldKey]: this.getDateFilter(filterValue.condition1) },
                { [fieldKey]: this.getDateFilter(filterValue.condition2) }
              ]
            };
          } else {
            filter = { [fieldKey]: this.getDateFilter(filterValue) };
          }
          break;
        }
        case 'set': {
          filter = { [fieldKey]: this.getSetFilter(filterValue) };
          break;
        }
        default: {
          console.warn(`[GRID-AGG] Unknown filter type: ${filterValue.filterType}`);
          break;
        }
      }

      if (filter) {
        queries.push(filter);
      }
    }

    if (queries.length === 1) {
      query = queries.shift();
    } else if (queries.length > 0) {
      query = { $and: queries };
    }

    return query;
  }

  /**
   * Build MongoDB number filter
   */
  private getNumberFilter(item: any): any {
    switch (item.type) {
      case 'equals':
        return { $eq: item.filter };
      case 'notEqual':
        return { $ne: item.filter };
      case 'greaterThan':
        return { $gt: item.filter };
      case 'greaterThanOrEqual':
        return { $gte: item.filter };
      case 'lessThan':
        return { $lt: item.filter };
      case 'lessThanOrEqual':
        return { $lte: item.filter };
      case 'inRange':
        return { $gte: item.filter, $lte: item.filterTo };
      default:
        console.warn(`[GRID-AGG] Unknown number filter type: ${item.type}`);
        return {};
    }
  }

  /**
   * Build MongoDB text filter
   */
  private getTextFilter(item: any): any {
    switch (item.type) {
      case 'equals':
        return { $eq: item.filter };
      case 'notEqual':
        return { $ne: item.filter };
      case 'contains':
        return { $regex: this.escapeRegex(item.filter), $options: 'i' };
      case 'notContains':
        return { $not: { $regex: this.escapeRegex(item.filter), $options: 'i' } };
      case 'startsWith':
        return { $regex: `^${this.escapeRegex(item.filter)}`, $options: 'i' };
      case 'endsWith':
        return { $regex: `${this.escapeRegex(item.filter)}$`, $options: 'i' };
      case 'blank':
        return { $in: [null, ''] };
      case 'notBlank':
        return { $nin: [null, ''], $exists: true };
      default:
        console.warn(`[GRID-AGG] Unknown text filter type: ${item.type}`);
        return {};
    }
  }

  /**
   * Build MongoDB date filter
   */
  private getDateFilter(item: any): any {
    const date = moment.utc(item.dateFrom).format('YYYY-MM-DD HH:mm:ss');

    switch (item.type) {
      case 'equals':
        return {
          $gte: new Date(moment.utc(date).startOf('day').toISOString()),
          $lte: new Date(moment.utc(date).endOf('day').toISOString())
        };
      case 'notEqual':
        return {
          $not: {
            $gte: new Date(moment.utc(date).startOf('day').toISOString()),
            $lte: new Date(moment.utc(date).endOf('day').toISOString())
          }
        };
      case 'greaterThan':
        return { $gte: new Date(moment.utc(date).endOf('day').toISOString()) };
      case 'greaterThanOrEqual':
        return { $gte: new Date(moment.utc(date).startOf('day').toISOString()) };
      case 'lessThan':
        return { $lt: new Date(moment.utc(date).startOf('day').toISOString()) };
      case 'lessThanOrEqual':
        return { $lte: new Date(moment.utc(date).endOf('day').toISOString()) };
      case 'inRange': {
        const utcDateTo = moment.utc(item.dateTo).toDate();
        return {
          $gte: new Date(moment.utc(date).startOf('day').toISOString()),
          $lte: new Date(moment.utc(utcDateTo).endOf('day').toISOString())
        };
      }
      default:
        console.warn(`[GRID-AGG] Unknown date filter type: ${item.type}`);
        return {};
    }
  }

  /**
   * Build MongoDB set filter ($in)
   */
  private getSetFilter(item: any): any {
    const values = item?.values || [];
    return {
      $in: values.map((value: string) => {
        // Handle boolean strings
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
      })
    };
  }

  /**
   * Map grid field names to MongoDB field paths
   */
  private convertFieldToKey(field: string): string {
    switch (field) {
      case 'category':
        return 'category.name';
      case 'createdBy':
        return 'createdByEmail';
      default:
        return field;
    }
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Retry a failed transcription
   * Resets the transcript to pending_download status so it can be re-processed
   */
  async retryTranscription(transcriptId: string, req?: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Retrying transcription ${transcriptId}`);

      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcript = await TranscriptModel.findById(transcriptId);

      if (!transcript) {
        return { success: false, error: 'Transcript not found' };
      }

      if (transcript.status !== 'failed') {
        return { success: false, error: `Can only retry failed transcriptions (current status: ${transcript.status})` };
      }

      // Reset to pending_download for re-processing
      transcript.status = 'pending_download';
      transcript.progress = 0;
      transcript.errorMessage = '';
      transcript.audioFilePath = undefined;
      transcript.processingStartedDate = undefined;
      await transcript.save();

      console.log(`Transcript ${transcriptId} reset for retry`);
      return { success: true };

    } catch (error: any) {
      console.error('Error retrying transcription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a transcription record
   * @param transcriptId The ID of the transcription to update
   * @param updateData The data to update (categoryId, category, videoTitle, etc.)
   * @param req Express request object - used to determine which database to use
   */
  async updateTranscription(transcriptId: string, updateData: any, req?: any): Promise<any> {
    try {
      console.log(`Updating transcription ${transcriptId}`);
      console.log('Update data:', JSON.stringify(updateData, null, 2));

      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcript = await TranscriptModel.findById(transcriptId);

      if (!transcript) {
        return null;
      }

      // Update allowed fields
      if (updateData.categoryId !== undefined) {
        transcript.categoryId = updateData.categoryId;
      }
      if (updateData.category !== undefined) {
        transcript.category = updateData.category;
      }
      if (updateData.videoTitle !== undefined) {
        transcript.videoTitle = updateData.videoTitle;
      }

      await transcript.save();

      console.log(`Transcription ${transcriptId} updated successfully`);
      return transcript;

    } catch (error: any) {
      console.error('Error updating transcription:', error);
      throw error;
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
   * @param req Express request object - used to determine which database to query
   */
  async getPendingDownloads(req?: any): Promise<ITranscript[]> {
    try {
      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcripts = await TranscriptModel.find({ status: 'pending_download' }).sort({ createdDate: 1 });
      return transcripts;
    } catch (error: any) {
      console.error('Error getting pending downloads:', error);
      return [];
    }
  }

  /**
   * Reset a transcript back to pending_download status
   * Used to retry transcription processing
   */
  async resetTranscript(transcriptId: string, req?: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Resetting transcript ${transcriptId} to pending_download`);

      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcript = await TranscriptModel.findById(transcriptId);

      if (!transcript) {
        return { success: false, error: 'Transcript not found' };
      }

      // Reset the transcript
      transcript.status = 'pending_download';
      transcript.progress = 0;
      transcript.errorMessage = '';
      transcript.audioFilePath = undefined;
      await transcript.save();

      console.log(`Transcript ${transcriptId} reset successfully`);
      return { success: true };

    } catch (error: any) {
      console.error('Error resetting transcript:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process a transcript with provided audio file
   * Called when audio file is available from android-sync
   * @param req Express request object - used to determine which database to query
   */
  async processWithAudioFile(transcriptId: string, audioFilePath: string, audioStreamUrl?: string, req?: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Processing transcript ${transcriptId}`);
      console.log(`  Audio file path: ${audioFilePath}`);
      console.log(`  Audio stream URL: ${audioStreamUrl || 'not provided'}`);
      console.log(`  Database: ${databaseService.isProductionRequest(req) ? 'PRODUCTION' : 'LOCAL'}`);

      // Get transcript document using appropriate database
      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcript = await TranscriptModel.findById(transcriptId);

      if (!transcript) {
        return { success: false, error: 'Transcript not found' };
      }

      if (transcript.status !== 'pending_download') {
        return { success: false, error: `Transcript is not in pending_download status (current: ${transcript.status})` };
      }

      // Determine the actual file path to use
      let actualAudioPath = audioFilePath;
      const fs = require('fs');

      // LOCAL OPTIMIZATION: Check if file exists locally first (avoids network transfer)
      // This is useful when android-sync and video-transcription run on the same machine
      if (audioFilePath && fs.existsSync(audioFilePath)) {
        console.log('✓ Using local file directly (no download needed):', audioFilePath);
        actualAudioPath = audioFilePath;
      } else if (audioStreamUrl) {
        // Fall back to HTTP streaming if file not accessible locally
        console.log('Downloading audio from stream URL...');
        try {
          actualAudioPath = await this.downloadAudioFromUrl(audioStreamUrl, transcriptId);
          console.log(`Downloaded audio to: ${actualAudioPath}`);
        } catch (downloadError: any) {
          console.error('Failed to download audio:', downloadError.message);
          // Log download error to audit log
          await auditLogService.logTranscriptionError(
            transcriptId,
            `Failed to download audio: ${downloadError.message}`,
            downloadError.stack,
            {
              audioStreamUrl,
              stage: 'downloadAudioFromUrl'
            }
          );
          return { success: false, error: `Failed to download audio: ${downloadError.message}` };
        }
      } else if (audioFilePath) {
        // audioFilePath provided but doesn't exist and no stream URL
        console.error(`Audio file not found locally: ${audioFilePath}`);
        // Log file not found error to audit log
        await auditLogService.logTranscriptionError(
          transcriptId,
          `Audio file not found locally: ${audioFilePath}`,
          undefined,
          {
            audioFilePath,
            stage: 'processWithAudioFile'
          }
        );
        return { success: false, error: `Audio file not found: ${audioFilePath}` };
      }

      // Determine request source
      const isProductionSource = req && databaseService.isProductionRequest(req);
      const requestSource = isProductionSource ? 'production' : 'local';

      // Update status to processing and track metrics
      transcript.status = 'processing';
      transcript.progress = 10;
      transcript.audioFilePath = actualAudioPath;
      transcript.requestSource = requestSource;
      transcript.processingStartedDate = new Date();
      await transcript.save();

      console.log(`  Request source: ${requestSource}`);

      // Start background processing (pass request for database selection)
      this.processTranscriptionWithFile(transcriptId, actualAudioPath, req).catch((error) => {
        console.error(`Error processing transcription ${transcriptId}:`, error);
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error processing with audio file:', error);
      // Log general processing error to audit log
      await auditLogService.logTranscriptionError(
        transcriptId,
        error.message,
        error.stack,
        {
          audioFilePath,
          audioStreamUrl,
          stage: 'processWithAudioFile'
        }
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Download audio file from a stream URL to local temp directory
   */
  private async downloadAudioFromUrl(streamUrl: string, transcriptId: string): Promise<string> {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Create temp directory for audio files if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'video-transcription');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Extract filename from URL or use transcriptId
    const urlPath = new URL(streamUrl, 'http://localhost').pathname;
    const ext = path.extname(urlPath) || '.mp4';
    const localPath = path.join(tempDir, `${transcriptId}${ext}`);

    console.log(`Downloading audio from: ${streamUrl}`);
    console.log(`Saving to: ${localPath}`);

    return new Promise((resolve, reject) => {
      const protocol = streamUrl.startsWith('https') ? https : http;
      const file = fs.createWriteStream(localPath);

      const request = protocol.get(streamUrl, (response: any) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirects
          file.close();
          fs.unlinkSync(localPath);
          this.downloadAudioFromUrl(response.headers.location, transcriptId)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(localPath);
          reject(new Error(`HTTP ${response.statusCode}: Failed to download audio`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length;
          const percent = totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0;
          if (percent % 20 === 0) {
            console.log(`  Download progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`  Download complete: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`);
          resolve(localPath);
        });
      });

      request.on('error', (err: Error) => {
        file.close();
        fs.unlink(localPath, () => {}); // Delete incomplete file
        reject(err);
      });

      file.on('error', (err: Error) => {
        file.close();
        fs.unlink(localPath, () => {}); // Delete incomplete file
        reject(err);
      });
    });
  }

  /**
   * Process transcription with a provided audio file (background task)
   * @param req Express request object - used to determine which database to use
   */
  private async processTranscriptionWithFile(transcriptId: string, audioFilePath: string, req?: any): Promise<void> {
    let convertedAudioPath: string | null = null;
    const TranscriptModel = getTranscriptModelForRequest(req);

    try {
      console.log(`Processing transcription with file: ${transcriptId}`);

      // Get transcript document
      const transcript = await TranscriptModel.findById(transcriptId);

      if (!transcript) {
        throw new Error(`Transcript not found: ${transcriptId}`);
      }

      // Check if we're using mock transcription (skip audio conversion)
      const useMock = serviceConfigs.useMockTranscription || serviceConfigs.transcriptionProvider === 'mock';

      if (useMock) {
        console.log('🎭 MOCK MODE: Skipping audio conversion');
        transcript.progress = 50;
        await transcript.save();
      } else {
        // Convert audio to speech-recognizable format
        console.log('Step 1: Converting audio format...');
        convertedAudioPath = await this.audioConverter.convertToSpeechFormat(audioFilePath);

        transcript.progress = 50;
        await transcript.save();
      }

      // Transcribe audio using the configured provider
      console.log('Step 2: Transcribing audio...');
      console.log(`  Provider: ${serviceConfigs.transcriptionProvider}`);
      console.log(`  Mock mode: ${serviceConfigs.useMockTranscription}`);
      let transcriptionResult: { transcript: string; processing_time: number; language?: string; duration?: number };

      // Check for mock transcription first
      if ((serviceConfigs.useMockTranscription || serviceConfigs.transcriptionProvider === 'mock') && this.mockTranscription) {
        console.log('  Using MOCK transcription');
        transcriptionResult = {
          transcript: await this.mockTranscription.transcribe(convertedAudioPath || 'mock-audio.m4a', transcript.language),
          processing_time: 0 // Mock transcription is instantaneous
        };
      } else if (serviceConfigs.transcriptionProvider === 'self-hosted' && this.selfHostedWhisper) {
        transcriptionResult = await this.selfHostedWhisper.transcribe(convertedAudioPath, transcript.language);
      } else if (serviceConfigs.transcriptionProvider === 'openai' && this.openaiWhisper) {
        // Assuming openaiWhisper.transcribe also returns an object with processing_time
        const openaiTranscriptText = await this.openaiWhisper.transcribe(convertedAudioPath, transcript.language);
        transcriptionResult = {
          transcript: openaiTranscriptText,
          processing_time: 0 // Placeholder, actual time would come from service
        };
      } else if (this.googleSpeech) {
        // Assuming googleSpeech.transcribe also returns an object with processing_time
        const googleTranscriptText = await this.googleSpeech.transcribe(convertedAudioPath, transcript.language);
        transcriptionResult = {
          transcript: googleTranscriptText,
          processing_time: 0 // Placeholder, actual time would come from service
        };
      } else {
        throw new Error(`No transcription provider available. Provider: ${serviceConfigs.transcriptionProvider}, Mock: ${serviceConfigs.useMockTranscription}`);
      }

      // Log processing time if available
      if (transcriptionResult.processing_time !== undefined) {
        console.log(`  Transcription processing time: ${transcriptionResult.processing_time.toFixed(2)}s`);
      }

      transcript.progress = 90;
      await transcript.save();

      // Save transcript and update document
      const wordCount = transcriptionResult.transcript.split(/\s+/).length;
      const completedDate = new Date();

      // Calculate transcription duration
      let transcriptionDurationMs: number | undefined;
      if (transcript.processingStartedDate) {
        transcriptionDurationMs = completedDate.getTime() - new Date(transcript.processingStartedDate).getTime();
      }

      transcript.transcript = transcriptionResult.transcript;
      transcript.wordCount = wordCount;
      transcript.status = 'completed';
      transcript.progress = 100;
      transcript.completedDate = completedDate;
      transcript.transcriptionDurationMs = transcriptionDurationMs;
      await transcript.save();

      console.log(`✓ Transcription completed: ${transcriptId}`);
      console.log(`  Words: ${wordCount}`);
      console.log(`  Length: ${transcriptionResult.transcript.length} characters`);
      console.log(`  Duration: ${transcriptionDurationMs ? (transcriptionDurationMs / 1000).toFixed(2) + 's' : 'unknown'}`);
      console.log(`  Source: ${transcript.requestSource || 'unknown'}`);

      // Auto-create a question with the transcript
      // Pass req so we know whether to route through orchestrator for production
      await this.autoCreateQuestion(transcript, req);

    } catch (error: any) {
      console.error(`✗ Transcription failed: ${transcriptId}`, error);

      // Get transcript details for audit log
      let videoTitle = 'Unknown';
      let videoUrl = 'Unknown';
      try {
        const failedTranscript = await TranscriptModel.findById(transcriptId);
        if (failedTranscript) {
          videoTitle = failedTranscript.videoTitle || 'Unknown';
          videoUrl = failedTranscript.youtubeUrl || 'Unknown';
        }
      } catch (e) {
        // Ignore errors getting transcript details
      }

      // Update transcript with error (use same model for consistency)
      await TranscriptModel.findByIdAndUpdate(transcriptId, {
        status: 'failed',
        errorMessage: error.message,
        progress: 0
      });

      // Log error to audit log service via orchestrator
      await auditLogService.logTranscriptionError(
        transcriptId,
        error.message,
        error.stack,
        {
          videoTitle,
          videoUrl,
          audioFilePath,
          stage: 'processTranscriptionWithFile',
          provider: serviceConfigs.transcriptionProvider
        }
      );

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
   *
   * @param transcript The completed transcript document
   * @param req Optional Express request - if from production (x-source-cluster: k8s),
   *            routes through orchestrator to create question in production DB
   */
  private async autoCreateQuestion(transcript: ITranscript, req?: any): Promise<void> {
    try {
      console.log(`📝 Auto-creating question for transcript: ${transcript._id}`);
      console.log(`  Video: ${transcript.videoTitle}`);
      console.log(`  Words: ${transcript.wordCount}`);

      // Log request headers for debugging
      console.log(`  Request headers available: ${req ? 'YES' : 'NO'}`);
      if (req?.headers) {
        console.log(`  x-source-cluster: ${req.headers['x-source-cluster'] || 'NOT SET'}`);
        console.log(`  x-route-questions-to: ${req.headers['x-route-questions-to'] || 'NOT SET'}`);
        console.log(`  x-forwarded-for: ${req.headers['x-forwarded-for'] || 'NOT SET'}`);
      }

      // Determine if this is a production request
      // Check both x-source-cluster (for DB) and x-route-questions-to (for question routing)
      const routeQuestionsTo = req?.headers?.['x-route-questions-to'];
      const isProduction = routeQuestionsTo === 'production' || (req && databaseService.isProductionRequest(req));
      console.log(`  Route questions to: ${routeQuestionsTo || 'not specified'}`);
      console.log(`  Target database: ${isProduction ? 'PRODUCTION' : 'LOCAL'}`);

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

      // Choose endpoint based on request origin:
      // - Production requests: Route through orchestrator (which connects to K8s questions service)
      // - Local requests: Call questions service directly
      let questionsUrl: string;
      let headers: any = {
        'Content-Type': 'application/json'
      };

      if (isProduction) {
        // Route through orchestrator to create question in production DB
        questionsUrl = `${serviceConfigs.orchestratorUrl}/api/questions`;
        // Pass through the cluster header so orchestrator knows this is a K8s request
        headers['x-source-cluster'] = 'k8s';
        console.log(`  Routing through orchestrator: POST ${questionsUrl}`);
      } else {
        // Call local questions service directly
        questionsUrl = `${serviceConfigs.questionsServiceUrl}/questions`;
        console.log(`  Calling local questions service: POST ${questionsUrl}`);
      }

      const axios = require('axios');
      const response = await axios.post(questionsUrl, questionPayload, {
        headers,
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

  /**
   * Refresh video title for an existing transcript by re-fetching from YouTube
   * Useful for fixing records with missing or empty titles
   */
  async refreshVideoTitle(transcriptId: string, req?: any): Promise<{ success: boolean; videoTitle?: string; error?: string }> {
    try {
      console.log(`Refreshing video title for transcript: ${transcriptId}`);

      const TranscriptModel = getTranscriptModelForRequest(req);
      const transcript = await TranscriptModel.findById(transcriptId);

      if (!transcript) {
        return { success: false, error: 'Transcript not found' };
      }

      if (!transcript.youtubeUrl) {
        return { success: false, error: 'No YouTube URL found for this transcript' };
      }

      // Try to fetch video info from YouTube API
      let videoTitle: string | null = null;

      if (this.youtubeApi) {
        try {
          console.log('Fetching video info from YouTube API...');
          const videoInfo = await this.youtubeApi.getVideoInfo(transcript.youtubeUrl);
          videoTitle = videoInfo.title;
          console.log(`Got title from YouTube API: ${videoTitle}`);
        } catch (error: any) {
          console.warn(`YouTube API failed: ${error.message}`);
        }
      }

      // If YouTube API failed, try Python downloader
      if (!videoTitle) {
        try {
          console.log('Trying Python downloader for video info...');
          const videoInfo = await this.youtubeDownloader.getVideoInfo(transcript.youtubeUrl);
          videoTitle = videoInfo.title;
          console.log(`Got title from Python downloader: ${videoTitle}`);
        } catch (error: any) {
          console.warn(`Python downloader failed: ${error.message}`);
        }
      }

      // Use fallback if still no title
      if (!videoTitle || !videoTitle.trim()) {
        videoTitle = `Video ${transcript.videoId || 'Unknown'}`;
        console.log(`Using fallback title: ${videoTitle}`);
      }

      // Update the transcript
      transcript.videoTitle = videoTitle;
      await transcript.save();

      console.log(`✓ Updated video title for transcript ${transcriptId}: ${videoTitle}`);
      return { success: true, videoTitle };

    } catch (error: any) {
      console.error('Error refreshing video title:', error);
      return { success: false, error: error.message };
    }
  }
}
