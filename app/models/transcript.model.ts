import mongoose, { Schema, Document } from 'mongoose';

export interface ITranscript extends Document {
  youtubeUrl: string;
  videoId: string;
  videoTitle?: string;
  videoDuration?: number;
  transcript: string;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
  questionId?: mongoose.Types.ObjectId;
  provider: 'google' | 'openai';
  audioFilePath?: string;
  createdDate: Date;
  completedDate?: Date;
  wordCount?: number;
  createdByGuid?: string;
  modifiedByGuid?: string;
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
    enum: ['pending', 'processing', 'completed', 'failed'],
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
    enum: ['google', 'openai'],
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
  }
}, {
  timestamps: true,
  collection: 'video-transcriptions'
});

// Indexes
TranscriptSchema.index({ createdDate: -1 });
TranscriptSchema.index({ status: 1, createdDate: -1 });
TranscriptSchema.index({ questionId: 1 });

export const Transcript = mongoose.model<ITranscript>('Transcript', TranscriptSchema);
