import mongoose, { Schema, Document, Connection, Model } from 'mongoose';
import { databaseService } from '../services/database.service';

export interface ITranscript extends Document {
  youtubeUrl: string;
  videoId: string;
  videoTitle?: string;
  videoDuration?: number;
  transcript: string;
  language: string;
  status: 'pending' | 'pending_download' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
  questionId?: mongoose.Types.ObjectId;
  provider: 'google' | 'openai' | 'self-hosted' | 'mock' | 'youtube-api-captions';
  audioFilePath?: string;
  createdDate: Date;
  completedDate?: Date;
  wordCount?: number;
  createdByGuid?: string;
  modifiedByGuid?: string;
  // Metrics
  transcriptionDurationMs?: number;  // How long the transcription took in milliseconds
  requestSource?: 'local' | 'production';  // Where the request originated from
  processingStartedDate?: Date;  // When processing started (for calculating duration)
}

const TranscriptSchema: Schema = new Schema({
  youtubeUrl: {
    type: String,
    required: true,
    index: true
  },
  videoId: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  videoTitle: {
    type: String
  },
  videoDuration: {
    type: Number
  },
  transcript: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'en-US'
  },
  status: {
    type: String,
    enum: ['pending', 'pending_download', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  errorMessage: {
    type: String
  },
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'Question'
  },
  provider: {
    type: String,
    enum: ['google', 'openai', 'self-hosted', 'mock', 'youtube-api-captions'],
    required: true
  },
  audioFilePath: {
    type: String
  },
  createdDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedDate: {
    type: Date
  },
  wordCount: {
    type: Number
  },
  createdByGuid: {
    type: String
  },
  modifiedByGuid: {
    type: String
  },
  // Metrics
  transcriptionDurationMs: {
    type: Number
  },
  requestSource: {
    type: String,
    enum: ['local', 'production']
  },
  processingStartedDate: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'video-transcriptions'
});

// Indexes
TranscriptSchema.index({ createdDate: -1 });
TranscriptSchema.index({ status: 1, createdDate: -1 });
TranscriptSchema.index({ questionId: 1 });

// Cache for compiled models per connection
const modelCache = new Map<Connection, Model<ITranscript>>();

/**
 * Get the Transcript model for a specific connection
 * This allows using different MongoDB databases based on request origin
 */
export function getTranscriptModel(connection: Connection): Model<ITranscript> {
  if (modelCache.has(connection)) {
    return modelCache.get(connection)!;
  }

  const model = connection.model<ITranscript>('Transcript', TranscriptSchema);
  modelCache.set(connection, model);
  return model;
}

/**
 * Get the Transcript model for the appropriate database based on request
 * @param req Express request object (optional) - used to determine local vs prod
 */
export function getTranscriptModelForRequest(req?: any): Model<ITranscript> {
  const connection = databaseService.getConnection(req);
  return getTranscriptModel(connection);
}

// Default export using default mongoose connection (for backwards compatibility)
export const Transcript = mongoose.model<ITranscript>('Transcript', TranscriptSchema);
