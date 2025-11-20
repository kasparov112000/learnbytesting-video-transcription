# Video Transcription Microservice

A Node.js/TypeScript microservice for transcribing YouTube videos using Google Cloud Speech-to-Text or OpenAI Whisper API.

## Features

- 🎥 Download audio from YouTube videos
- 🔄 Convert audio to speech-recognizable formats (WAV/FLAC)
- 🗣️ Transcribe using **Google Cloud Speech-to-Text** or **OpenAI Whisper**
- 🔄 Switch between providers via environment variables
- 💾 Store transcripts in MongoDB
- 📊 Track transcription progress and status
- 🗑️ Automatic cleanup of temporary audio files

## Architecture

```
YouTube URL → Download Audio → Convert Format → Transcribe → Save to MongoDB
                                                  ↓
                                    Google Cloud Speech-to-Text
                                            OR
                                      OpenAI Whisper API
```

## Prerequisites

- Node.js 18+ and npm
- MongoDB 4.4+
- FFmpeg (for audio conversion)
- **Google Cloud Project** with Speech-to-Text API enabled
  - OR **OpenAI API Key**

## Installation

### 1. Install Dependencies

```bash
cd video-transcription
npm install
```

### 2. Install FFmpeg

#### Windows:
```bash
choco install ffmpeg
```

#### macOS:
```bash
brew install ffmpeg
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

### 3. Set Up Environment Variables

```bash
cp .env.template .env
```

Edit `.env` with your configuration:

```env
# Transcription Provider: 'google' or 'openai'
TRANSCRIPTION_PROVIDER=google

# For Google Cloud Speech-to-Text
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# For OpenAI Whisper (alternative)
OPENAI_API_KEY=sk-your-openai-api-key-here

# MongoDB
MONGODB_URL=mongodb://localhost:27017/mdr-video-transcriptions
```

### 4. Set Up Google Cloud Speech-to-Text API

#### Step 1: Enable the API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Go to **APIs & Services > Library**
4. Search for "Speech-to-Text API"
5. Click **Enable**

#### Step 2: Create Service Account

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > Service Account**
3. Fill in the details:
   - Name: `video-transcription-sa`
   - Role: **Cloud Speech Service Agent** or **Cloud Speech Administrator**
4. Click **Create and Continue**
5. Click **Done**

#### Step 3: Create and Download Credentials

1. Click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key > Create new key**
4. Select **JSON** format
5. Click **Create**
6. Save the downloaded JSON file as `google-credentials.json` in the project root

> **Note**: The Google Cloud Speech-to-Text API uses **service account credentials**, which is different from the OAuth credentials used for user authentication. Both can be in the same Google Cloud project.

### 5. Alternative: Set Up OpenAI Whisper API

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file:

```env
TRANSCRIPTION_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

## Running the Service

### Development Mode

```bash
npm run start
# or
npm run start:dev
```

### Production Mode

```bash
npm run build
npm run start:server
```

The service will start on **port 3016** by default.

## API Endpoints

### 1. Start Transcription

**POST** `/transcription/transcribe`

Request body:
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "language": "en-US",
  "questionId": "691f5abf5f38017664c5cbcf"
}
```

Response:
```json
{
  "transcriptionId": "507f1f77bcf86cd799439011",
  "status": "processing",
  "message": "Transcription started successfully"
}
```

### 2. Get Transcription Status

**GET** `/transcription/status/:id`

Response:
```json
{
  "transcriptionId": "507f1f77bcf86cd799439011",
  "status": "completed",
  "progress": 100,
  "videoTitle": "Chess Game Analysis",
  "videoDuration": 1845,
  "language": "en-US",
  "provider": "google"
}
```

### 3. Get Completed Transcript

**GET** `/transcription/transcript/:id`

Response:
```json
{
  "transcriptionId": "507f1f77bcf86cd799439011",
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "transcript": "Full transcript text...",
  "videoTitle": "Chess Game Analysis",
  "videoDuration": 1845,
  "language": "en-US",
  "wordCount": 5420
}
```

### 4. Get Transcripts by Question

**GET** `/transcription/question/:questionId`

### 5. Delete Transcript

**DELETE** `/transcription/:id`

### 6. Health Check

**GET** `/health`

## Testing the API

### Using cURL

```bash
# Start transcription
curl -X POST http://localhost:3016/transcription/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "language": "en-US"
  }'

# Check status
curl http://localhost:3016/transcription/status/TRANSCRIPT_ID

# Get transcript
curl http://localhost:3016/transcription/transcript/TRANSCRIPT_ID
```

### Using Postman

1. Import the collection from `docs/postman-collection.json`
2. Set the base URL to `http://localhost:3016`
3. Try the "Start Transcription" request

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENV_NAME` | Environment name | `LOCAL` |
| `PORT` | Server port | `3016` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017/mdr-video-transcriptions` |
| `TRANSCRIPTION_PROVIDER` | Provider: `google` or `openai` | `google` |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud project ID | - |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to credentials JSON | `./google-credentials.json` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `MAX_VIDEO_LENGTH_SECONDS` | Maximum video duration | `7200` (2 hours) |
| `AUDIO_FORMAT` | Audio format: `wav` or `flac` | `wav` |
| `AUDIO_CHANNELS` | Audio channels (1=mono) | `1` |
| `AUDIO_SAMPLE_RATE` | Sample rate in Hz | `16000` |
| `DEFAULT_LANGUAGE` | Default language code | `en-US` |
| `CLEANUP_TEMP_FILES` | Auto-delete temp files | `true` |

### Supported Languages

**Google Cloud Speech-to-Text**:
- English: `en-US`, `en-GB`, `en-AU`, etc.
- Spanish: `es-ES`, `es-MX`, etc.
- French: `fr-FR`, `fr-CA`, etc.
- [Full list](https://cloud.google.com/speech-to-text/docs/languages)

**OpenAI Whisper**:
- 98+ languages supported
- Use ISO-639-1 codes: `en`, `es`, `fr`, etc.

## Cost Considerations

### Google Cloud Speech-to-Text
- Standard model: $0.006 per 15 seconds (~$1.44/hour)
- Video model: $0.012 per 15 seconds (~$2.88/hour)
- First 60 minutes free per month

### OpenAI Whisper
- $0.006 per minute (~$0.36/hour)
- 25MB file size limit

## Troubleshooting

### FFmpeg not found

```
Error: FFmpeg not found
```

**Solution**: Install FFmpeg (see Installation section)

### Google Cloud Authentication Error

```
Error: Could not load the default credentials
```

**Solution**:
1. Check that `GOOGLE_APPLICATION_CREDENTIALS` points to the correct JSON file
2. Verify the service account has the correct permissions
3. Make sure the Speech-to-Text API is enabled

### OpenAI Rate Limit

```
Error: OpenAI API rate limit exceeded
```

**Solution**:
1. Wait a few minutes and try again
2. Consider upgrading your OpenAI plan
3. Switch to Google Cloud Speech-to-Text

### MongoDB Connection Failed

```
Error: Unable to connect to MongoDB
```

**Solution**:
1. Make sure MongoDB is running: `mongod --version`
2. Check the connection string in `.env`
3. Verify MongoDB is accessible on the configured port

## Integration with Orchestrator

Add to `/orchestrator/src/config/configured-services.ts`:

```typescript
{
  name: 'transcription',
  url: ENV_NAME === 'LOCAL'
    ? 'http://localhost:3016'
    : 'http://video-transcription:3016',
  port: 3016
}
```

Add route in `/orchestrator/src/routes/transcription.api.ts`:

```typescript
router.post('/api/transcription/transcribe', (req, res) => {
  transcriptionService.post(req, res);
});
```

## Development

### Project Structure

```
video-transcription/
├── app/
│   ├── models/              # MongoDB schemas
│   ├── services/            # Business logic
│   │   ├── youtube-downloader.service.ts
│   │   ├── audio-converter.service.ts
│   │   ├── google-speech.service.ts
│   │   ├── openai-whisper.service.ts
│   │   └── transcription.service.ts
│   ├── routes/              # API endpoints
│   ├── server.ts            # Express server
│   └── index.ts             # Entry point
├── config/                  # Configuration
├── temp/audio/              # Temporary audio files
└── package.json
```

### Adding New Features

1. Create new service in `app/services/`
2. Add route in `app/routes/default.api.ts`
3. Update `TranscriptionService` to use the new service

## License

ISC

## Support

For issues or questions, please check the main project documentation or create an issue in the repository.
