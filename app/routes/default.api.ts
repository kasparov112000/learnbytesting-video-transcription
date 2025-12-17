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
        questionId,
        req
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

      const transcript = await transcriptionService.getTranscriptionStatus(id, req);

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

      const transcript = await transcriptionService.getTranscript(id, req);

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
        wordCount: transcript.wordCount,
        categoryId: transcript.categoryId,
        category: transcript.category
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

      const transcripts = await transcriptionService.getTranscriptsByQuestionId(questionId, req);

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
   *
   * NOTE: This endpoint uses dynamic database selection based on request origin.
   * - Requests from Tailscale/K8s (100.x.x.x, 10.x.x.x) use production MongoDB
   * - Local requests (localhost, 127.0.0.1) use local MongoDB
   */
  router.get('/transcription/pending', async (req: any, res: any) => {
    try {
      console.log('GET /transcription/pending');
      console.log('  Request origin:', req.ip, req.headers['x-forwarded-for'] || '');
      console.log('  x-source-cluster header:', req.headers['x-source-cluster'] || 'NOT SET');

      // Pass request for database selection
      const transcripts = await transcriptionService.getPendingDownloads(req);

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
   * NOTE: This endpoint uses dynamic database selection based on request origin.
   * - Requests from Tailscale/K8s use production MongoDB
   * - Local requests use local MongoDB
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
      console.log('Request origin:', req.ip, req.headers['x-forwarded-for'] || '');
      console.log('x-source-cluster:', req.headers['x-source-cluster'] || 'NOT SET');
      console.log('x-route-questions-to:', req.headers['x-route-questions-to'] || 'NOT SET');

      // Pass request for database selection
      const result = await transcriptionService.processWithAudioFile(id, audioFilePath, audioStreamUrl, req);

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

      const result = await transcriptionService.resetTranscript(id, req);

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

      const success = await transcriptionService.deleteTranscript(id, req);

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
   * PUT /transcription/:id
   * Update a transcript (category, videoTitle, etc.)
   */
  router.put('/transcription/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      console.log('PUT /transcription/:id');
      console.log('Transcript ID:', id);
      console.log('Update data:', JSON.stringify(updateData, null, 2));

      const result = await transcriptionService.updateTranscription(id, updateData, req);

      if (!result) {
        return res.status(404).json({
          error: 'Transcript not found'
        });
      }

      res.status(200).json({
        message: 'Transcript updated successfully',
        transcription: result
      });

    } catch (error: any) {
      console.error('Error updating transcript:', error);
      res.status(500).json({
        error: error.message || 'Failed to update transcript'
      });
    }
  });

  /**
   * GET /transcription/list
   * Get all transcriptions with pagination and filtering
   *
   * Query params:
   * - page: Page number (default: 1)
   * - pageSize: Items per page (default: 20)
   * - status: Filter by status
   * - sortBy: Field to sort by (default: createdDate)
   * - sortOrder: 'asc' or 'desc' (default: desc)
   */
  router.get('/transcription/list', async (req: any, res: any) => {
    try {
      console.log('GET /transcription/list');
      console.log('Query params:', req.query);

      const params = {
        page: parseInt(req.query.page) || 1,
        pageSize: parseInt(req.query.pageSize) || 20,
        status: req.query.status,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await transcriptionService.getAll(req, params);

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting transcription list:', error);
      res.status(500).json({
        error: error.message || 'Failed to get transcription list'
      });
    }
  });

  /**
   * POST /transcription/grid
   * Get transcriptions for ag-grid with server-side pagination
   * Supports sorting, filtering, and pagination from ag-grid requests
   *
   * Request body:
   * {
   *   "startRow": 0,
   *   "endRow": 20,
   *   "sortModel": [{ "colId": "createdDate", "sort": "desc" }],
   *   "filterModel": { "status": { "filterType": "set", "values": ["completed"] } },
   *   "search": { "search": "search text" }
   * }
   */
  router.post('/transcription/grid', async (req: any, res: any) => {
    try {
      console.log('POST /transcription/grid');
      console.log('Request body:', JSON.stringify(req.body, null, 2));

      const result = await transcriptionService.getGrid(req, req.body);

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting grid data:', error);
      res.status(500).json({
        error: error.message || 'Failed to get grid data'
      });
    }
  });

  /**
   * POST /transcription/retry/:id
   * Retry a failed transcription
   * Resets the transcript to pending_download status
   */
  router.post('/transcription/retry/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params;

      console.log('POST /transcription/retry/:id');
      console.log('Transcription ID:', id);

      const result = await transcriptionService.retryTranscription(id, req);

      if (!result.success) {
        return res.status(400).json({
          error: result.error || 'Failed to retry transcription'
        });
      }

      res.status(200).json({
        message: 'Transcription queued for retry',
        transcriptionId: id,
        status: 'pending_download'
      });

    } catch (error: any) {
      console.error('Error retrying transcription:', error);
      res.status(500).json({
        error: error.message || 'Failed to retry transcription'
      });
    }
  });

  /**
   * POST /transcription/:id/refresh-title
   * Re-fetch and update the video title from YouTube for an existing record
   * Useful for fixing records with missing or incorrect titles
   */
  router.post('/transcription/:id/refresh-title', async (req: any, res: any) => {
    try {
      const { id } = req.params;

      console.log('POST /transcription/:id/refresh-title');
      console.log('Transcription ID:', id);

      const result = await transcriptionService.refreshVideoTitle(id, req);

      if (!result.success) {
        return res.status(400).json({
          error: result.error || 'Failed to refresh video title'
        });
      }

      res.status(200).json({
        message: 'Video title refreshed successfully',
        transcriptionId: id,
        videoTitle: result.videoTitle
      });

    } catch (error: any) {
      console.error('Error refreshing video title:', error);
      res.status(500).json({
        error: error.message || 'Failed to refresh video title'
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
