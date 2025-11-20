# Video Transcription Microservice - Setup Complete ✅

**Date:** November 20, 2025
**Status:** Service is running and ready for testing

## What's Been Accomplished

### ✅ FFmpeg Installation
- **Version:** FFmpeg 8.0 (Essentials Build)
- **Location:** `C:\Users\Renato\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0-essentials_build\bin`
- **Status:** Installed via Windows Package Manager (winget)
- **Note:** You may need to restart your terminal to access FFmpeg from the command line via PATH

### ✅ Microservice Created
Complete Node.js/TypeScript microservice with:
- YouTube video download capability (ytdl-core)
- Audio format conversion (FFmpeg)
- Dual transcription providers:
  - **Google Cloud Speech-to-Text** (service account credentials)
  - **OpenAI Whisper API** (simpler setup)
- MongoDB storage for transcripts
- Background processing with progress tracking
- REST API with 6 endpoints

### ✅ Dependencies Installed
- Total packages: 463
- Security vulnerabilities: 0
- All required dependencies installed and working

### ✅ Service Running
- **Port:** 3016
- **Environment:** LOCAL
- **Provider:** Google Cloud (configurable via .env)
- **MongoDB:** Connected successfully
- **Health Check:** ✅ Passing

## Service Architecture

```
YouTube URL → Download Audio → Convert to WAV/FLAC → Transcribe → Save to MongoDB
                                                      ↓
                                        Google Cloud Speech-to-Text
                                                    OR
                                          OpenAI Whisper API
```

## API Endpoints

All endpoints are now live and accessible at `http://localhost:3016`:

### 1. Health Check
```bash
GET http://localhost:3016/health
```

Response:
```json
{
  "status": "ok",
  "service": "video-transcription",
  "timestamp": "2025-11-20T22:49:21.216Z"
}
```

### 2. Start Transcription
```bash
POST http://localhost:3016/transcription/transcribe
Content-Type: application/json

{
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "language": "en-US",
  "questionId": "691f5abf5f38017664c5cbcf"
}
```

### 3. Check Status
```bash
GET http://localhost:3016/transcription/status/:transcriptionId
```

### 4. Get Transcript
```bash
GET http://localhost:3016/transcription/transcript/:transcriptionId
```

### 5. Get by Question
```bash
GET http://localhost:3016/transcription/question/:questionId
```

### 6. Delete Transcript
```bash
DELETE http://localhost:3016/transcription/:transcriptionId
```

## Configuration

Current configuration in `.env`:

```env
ENV_NAME=LOCAL
PORT=3016
MONGODB_URL=mongodb://localhost:27017/mdr-video-transcriptions
TRANSCRIPTION_PROVIDER=openai
```

## Next Steps

### Option 1: Test with OpenAI Whisper (Easier)

1. **Get OpenAI API Key**:
   - Go to https://platform.openai.com/api-keys
   - Create a new API key

2. **Update `.env`**:
   ```env
   TRANSCRIPTION_PROVIDER=openai
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. **Restart the service**:
   ```bash
   # Kill the current process
   # Then restart
   cd C:\Users\Renato\repos\lbt\video-transcription
   npm run start
   ```

4. **Test with a YouTube URL**:
   ```bash
   curl -X POST http://localhost:3016/transcription/transcribe \
     -H "Content-Type: application/json" \
     -d '{
       "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
       "language": "en"
     }'
   ```

### Option 2: Set Up Google Cloud Speech-to-Text

Follow the detailed guide in `GOOGLE_SPEECH_API_SETUP.md`:

1. Enable Speech-to-Text API in Google Cloud Console
2. Create a Service Account
3. Download credentials JSON file
4. Save as `google-credentials.json` in project root
5. Update `.env` with your project ID
6. Restart the service

**Important:** Google Cloud Speech-to-Text uses **Service Account credentials** (different from OAuth credentials used for "Sign in with Google"). Both can exist in the same Google Cloud project.

## Testing the Service

### Test Health Endpoint
```bash
curl http://localhost:3016/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "video-transcription",
  "timestamp": "2025-11-20T22:49:21.216Z"
}
```

### Test Transcription (requires API key)
```bash
curl -X POST http://localhost:3016/transcription/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "youtubeUrl": "https://www.youtube.com/watch?v=SHORT_VIDEO_ID",
    "language": "en-US"
  }'
```

This will return a transcription ID. Use it to check status:
```bash
curl http://localhost:3016/transcription/status/TRANSCRIPTION_ID
```

## Files Created

### Core Service Files
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.env` - Environment variables (not committed to git)
- `.env.template` - Template for environment variables
- `.gitignore` - Excludes credentials and temp files

### Configuration
- `config/global.config.ts` - Service configuration

### Database Models
- `app/models/transcript.model.ts` - MongoDB schema

### Services
- `app/services/youtube-downloader.service.ts` - YouTube audio download
- `app/services/audio-converter.service.ts` - FFmpeg audio conversion
- `app/services/google-speech.service.ts` - Google Cloud Speech-to-Text
- `app/services/openai-whisper.service.ts` - OpenAI Whisper API
- `app/services/transcription.service.ts` - Main orchestration service

### API Layer
- `app/routes/default.api.ts` - REST API endpoints
- `app/server.ts` - Express server setup
- `app/index.ts` - Entry point with graceful shutdown

### Documentation
- `README.md` - Complete service documentation
- `GOOGLE_SPEECH_API_SETUP.md` - Detailed setup guide for Google Cloud
- `SETUP_COMPLETE.md` - This file

## Troubleshooting

### FFmpeg not found in new terminal
**Solution:** Restart your terminal or manually add to PATH:
```
C:\Users\Renato\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0-essentials_build\bin
```

### Service won't start
**Check:**
1. MongoDB is running: `powershell -Command "Get-Service MongoDB"`
2. Port 3016 is not in use: `netstat -ano | findstr :3016`
3. Node modules are installed: `cd video-transcription && npm install`

### Transcription fails
**Check:**
1. API key is configured in `.env`
2. YouTube URL is valid and accessible
3. Video is not too long (max 7200 seconds / 2 hours by default)
4. Check service logs for error details

## Cost Estimates

### OpenAI Whisper
- **Price:** $0.006 per minute (~$0.36 per hour)
- **File limit:** 25MB
- **Accuracy:** Excellent
- **Languages:** 98+

### Google Cloud Speech-to-Text
- **Free tier:** 60 minutes per month
- **Standard:** $0.006 per 15 seconds (~$1.44 per hour)
- **Video model:** $0.012 per 15 seconds (~$2.88 per hour)
- **Enhanced:** $0.009 per 15 seconds (~$2.16 per hour)

## Integration with Orchestrator

To make this service accessible through the main orchestrator:

1. **Add to configured services** (`orchestrator/src/config/configured-services.ts`):
```typescript
{
  name: 'transcription',
  url: ENV_NAME === 'LOCAL'
    ? 'http://localhost:3016'
    : 'http://video-transcription:3016',
  port: 3016
}
```

2. **Create route file** (`orchestrator/src/routes/transcription.api.ts`):
```typescript
router.post('/api/transcription/transcribe', (req, res) => {
  transcriptionService.post(req, res);
});

router.get('/api/transcription/status/:id', (req, res) => {
  transcriptionService.get(req, res);
});
```

3. **Register in DI container** (`orchestrator/src/lib/di/di.ts`)

## Summary

✅ **Service Status:** Running and healthy
✅ **Dependencies:** All installed (463 packages, 0 vulnerabilities)
✅ **FFmpeg:** Version 8.0 installed and working
✅ **MongoDB:** Connected successfully
✅ **API:** 6 endpoints ready to use
✅ **Documentation:** Complete guides available

**Next Action:** Configure API key (OpenAI or Google Cloud) and test transcription!

---

For detailed information, see:
- `README.md` - Complete service documentation
- `GOOGLE_SPEECH_API_SETUP.md` - Google Cloud setup guide
