import { TranscriptionService } from '../services/transcription.service';

export default function (app: any, express: any) {
  const router = express.Router();
  const transcriptionService = new TranscriptionService();

  // Sanitize user input to prevent NoSQL injection
  const sanitize = require('mongo-sanitize');

  function MongoSanitize(data: any) {
    return sanitize(data);
  }

  // Apply sanitization middleware to all routes
  router.use('/transcription', function (req: any, res: any, next: any) {
    req.body = MongoSanitize(req.body);
    req.params = MongoSanitize(req.params);
    next();
  });

  /**
   * POST /transcription/transcribe
   * Start a new transcription
   *
   * Request body:
   * {
   *   "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
   *   "language": "en-US" // optional, default from config
   *   "questionId": "691f5abf5f38017664c5cbcf" // optional
   * }
   *
   * Response:
   * {
   *   "transcriptionId": "507f1f77bcf86cd799439011",
   *   "status": "processing",
   *   "message": "Transcription started"
   * }
   */
  router.post('/transcription/transcribe', async (req: any, res: any) => {
    try {
      const { youtubeUrl, language, questionId } = req.body;

      if (!youtubeUrl) {
        return res.status(400).json({
          error: 'Missing required field: youtubeUrl'
        });
      }

      console.log('POST /transcription/transcribe');
      console.log('YouTube URL:', youtubeUrl);
      console.log('Language:', language);
      console.log('Question ID:', questionId);

      const transcriptId = await transcriptionService.startTranscription(
        youtubeUrl,
        language,
        questionId
      );

      res.status(202).json({
        transcriptionId: transcriptId,
        status: 'processing',
        message: 'Transcription started successfully'
      });

    } catch (error: any) {
      console.error('Error starting transcription:', error);
      res.status(500).json({
        error: error.message || 'Failed to start transcription'
      });
    }
  });

  /**
   * GET /transcription/status/:id
   * Get transcription status
   *
   * Response:
   * {
   *   "transcriptionId": "507f1f77bcf86cd799439011",
   *   "status": "completed" | "processing" | "failed" | "pending",
   *   "progress": 75,
   *   "videoTitle": "Video Title",
   *   "videoDuration": 1845
   * }
   */
  router.get('/transcription/status/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params;

      console.log('GET /transcription/status/:id');
      console.log('Transcript ID:', id);

      const transcript = await transcriptionService.getTranscriptionStatus(id);

      if (!transcript) {
        return res.status(404).json({
          error: 'Transcription not found'
        });
      }

      res.status(200).json({
        transcriptionId: transcript._id,
        status: transcript.status,
        progress: transcript.progress,
        videoTitle: transcript.videoTitle,
        videoDuration: transcript.videoDuration,
        language: transcript.language,
        provider: transcript.provider,
        errorMessage: transcript.errorMessage,
        createdDate: transcript.createdDate,
        completedDate: transcript.completedDate
      });

    } catch (error: any) {
      console.error('Error getting transcription status:', error);
      res.status(500).json({
        error: error.message || 'Failed to get transcription status'
      });
    }
  });

  /**
   * GET /transcription/transcript/:id
   * Get completed transcript
   *
   * Response:
   * {
   *   "transcriptionId": "507f1f77bcf86cd799439011",
   *   "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
   *   "transcript": "Full transcript text...",
   *   "videoTitle": "Video Title",
   *   "language": "en-US",
   *   "createdDate": "2025-11-20T15:00:00Z",
   *   "wordCount": 5420
   * }
   */
  router.get('/transcription/transcript/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params;

      console.log('GET /transcription/transcript/:id');
      console.log('Transcript ID:', id);

      const transcript = await transcriptionService.getTranscript(id);

      if (!transcript) {
        return res.status(404).json({
          error: 'Transcript not found'
        });
      }

      if (transcript.status !== 'completed') {
        return res.status(400).json({
          error: 'Transcript is not yet completed',
          status: transcript.status,
          progress: transcript.progress
        });
      }

      res.status(200).json({
        transcriptionId: transcript._id,
        youtubeUrl: transcript.youtubeUrl,
        transcript: transcript.transcript,
        videoTitle: transcript.videoTitle,
        videoDuration: transcript.videoDuration,
        language: transcript.language,
        provider: transcript.provider,
        createdDate: transcript.createdDate,
        completedDate: transcript.completedDate,
        wordCount: transcript.wordCount
      });

    } catch (error: any) {
      console.error('Error getting transcript:', error);
      res.status(500).json({
        error: error.message || 'Failed to get transcript'
      });
    }
  });

  /**
   * GET /transcription/question/:questionId
   * Get all transcripts for a specific question
   */
  router.get('/transcription/question/:questionId', async (req: any, res: any) => {
    try {
      const { questionId } = req.params;

      console.log('GET /transcription/question/:questionId');
      console.log('Question ID:', questionId);

      const transcripts = await transcriptionService.getTranscriptsByQuestionId(questionId);

      res.status(200).json({
        questionId,
        transcripts: transcripts.map(t => ({
          transcriptionId: t._id,
          youtubeUrl: t.youtubeUrl,
          videoTitle: t.videoTitle,
          status: t.status,
          progress: t.progress,
          createdDate: t.createdDate,
          completedDate: t.completedDate
        }))
      });

    } catch (error: any) {
      console.error('Error getting transcripts by question ID:', error);
      res.status(500).json({
        error: error.message || 'Failed to get transcripts'
      });
    }
  });

  /**
   * GET /transcription/pending
   * Get all transcripts with pending_download status
   * Used by jobs service to poll for records that need processing
   */
  router.get('/transcription/pending', async (req: any, res: any) => {
    try {
      console.log('GET /transcription/pending');

      const transcripts = await transcriptionService.getPendingDownloads();

      res.status(200).json({
        count: transcripts.length,
        transcripts: transcripts.map(t => ({
          transcriptionId: t._id,
          videoId: t.videoId,
          youtubeUrl: t.youtubeUrl,
          videoTitle: t.videoTitle,
          status: t.status,
          createdDate: t.createdDate
        }))
      });

    } catch (error: any) {
      console.error('Error getting pending transcripts:', error);
      res.status(500).json({
        error: error.message || 'Failed to get pending transcripts'
      });
    }
  });

  /**
   * POST /transcription/process/:id
   * Trigger processing for a pending_download transcript
   * Called by jobs service when audio file is available
   *
   * Request body:
   * {
   *   "audioFilePath": "/path/to/audio/file.m4a",  // Local file path (for local dev)
   *   "audioStreamUrl": "http://android-sync:80/stream-file/xxx",  // Stream URL (for K8s)
   *   "fileId": "mongodb_file_id"  // Optional file ID
   * }
   */
  router.post('/transcription/process/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { audioFilePath, audioStreamUrl, fileId } = req.body;

      console.log('POST /transcription/process/:id');
      console.log('Transcript ID:', id);
      console.log('Audio file path:', audioFilePath);
      console.log('Audio stream URL:', audioStreamUrl);
      console.log('File ID:', fileId);

      const result = await transcriptionService.processWithAudioFile(id, audioFilePath, audioStreamUrl);

      if (!result.success) {
        return res.status(400).json({
          error: result.error || 'Failed to process transcript'
        });
      }

      res.status(200).json({
        transcriptionId: id,
        status: 'processing',
        message: 'Transcription processing started'
      });

    } catch (error: any) {
      console.error('Error processing transcript:', error);
      res.status(500).json({
        error: error.message || 'Failed to process transcript'
      });
    }
  });

  /**
   * POST /transcription/:id/reset
   * Reset a failed/completed transcript back to pending_download
   * Used to retry transcription processing
   */
  router.post('/transcription/:id/reset', async (req: any, res: any) => {
    try {
      const { id } = req.params;

      console.log('POST /transcription/:id/reset');
      console.log('Transcript ID:', id);

      const result = await transcriptionService.resetTranscript(id);

      if (!result.success) {
        return res.status(404).json({
          error: result.error || 'Transcript not found'
        });
      }

      res.status(200).json({
        message: 'Transcript reset to pending_download',
        transcriptionId: id
      });

    } catch (error: any) {
      console.error('Error resetting transcript:', error);
      res.status(500).json({
        error: error.message || 'Failed to reset transcript'
      });
    }
  });

  /**
   * DELETE /transcription/:id
   * Delete a transcript
   */
  router.delete('/transcription/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params;

      console.log('DELETE /transcription/:id');
      console.log('Transcript ID:', id);

      const success = await transcriptionService.deleteTranscript(id);

      if (!success) {
        return res.status(404).json({
          error: 'Transcript not found'
        });
      }

      res.status(200).json({
        message: 'Transcript deleted successfully'
      });

    } catch (error: any) {
      console.error('Error deleting transcript:', error);
      res.status(500).json({
        error: error.message || 'Failed to delete transcript'
      });
    }
  });

  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', (req: any, res: any) => {
    res.status(200).json({
      status: 'ok',
      service: 'video-transcription',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
