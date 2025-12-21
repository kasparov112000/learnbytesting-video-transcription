import mongoose, { Schema, Document, Connection, Model } from 'mongoose';
import { databaseService } from '../services/database.service';

export interface ITranscript extends Document {
  youtubeUrl?: string;  // Optional for file uploads
  videoId?: string;  // Optional for file uploads
  videoTitle?: string;
  videoDuration?: number;
  transcript: string;
  language: string;
  status: 'pending' | 'pending_download' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
  questionId?: mongoose.Types.ObjectId;
  categoryId?: string;  // Reference to category
  category?: any;  // Category object with name, displayName, etc.
  provider: 'google' | 'openai' | 'self-hosted' | 'mock' | 'youtube-api-captions';
  audioFilePath?: string;
  createdDate: Date;
  completedDate?: Date;
  wordCount?: number;
  createdByGuid?: string;
  createdByEmail?: string;
  modifiedByGuid?: string;
  // Metrics
  transcriptionDurationMs?: number;  // How long the transcription took in milliseconds
  requestSource?: 'local' | 'production';  // Where the request originated from
  processingStartedDate?: Date;  // When processing started (for calculating duration)
  // New fields for upload flow
  sourceType?: 'youtube-url' | 'youtube-recording' | 'file-upload';  // How the audio was obtained
  originalFilename?: string;  // Original uploaded filename
  mimeType?: string;  // MIME type of uploaded file
  fileSize?: number;  // Size of uploaded file in bytes
}

const TranscriptSchema: Schema = new Schema({
  youtubeUrl: {
    type: String,
    index: true,
    sparse: true  // Allow null/undefined values in index
  },
  videoId: {
    type: String,
    sparse: true  // Allow null/undefined values in index
    // Note: Compound index with createdByGuid defined below to allow same video for different users
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
  categoryId: {
    type: String,
    index: true
  },
  category: {
    type: Schema.Types.Mixed  // Flexible object to store category data
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
    type: String,
    index: true
  },
  createdByEmail: {
    type: String,
    index: true
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
  },
  // New fields for upload flow
  sourceType: {
    type: String,
    enum: ['youtube-url', 'youtube-recording', 'file-upload'],
    default: 'youtube-url'
  },
  originalFilename: {
    type: String
  },
  mimeType: {
    type: String
  },
  fileSize: {
    type: Number
  }
}, {
  timestamps: true,
  collection: 'video-transcriptions'
});

// Indexes
TranscriptSchema.index({ createdDate: -1 });
TranscriptSchema.index({ status: 1, createdDate: -1 });
TranscriptSchema.index({ questionId: 1 });
// Compound index to allow same video for different users (unique per user)
TranscriptSchema.index({ videoId: 1, createdByGuid: 1 }, { unique: true, sparse: true });

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
