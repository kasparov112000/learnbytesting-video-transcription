# Mock Mode - Quick Start Guide

## ✅ What I Created For You

I've implemented a complete **Mock Transcription Service** that lets you test without API charges!

### Files Created/Modified:
1. ✅ **Mock Service**: `app/services/mock-transcription.service.ts`
2. ✅ **Config Updated**: `config/global.config.ts` - Added `useMockTranscription` flag
3. ✅ **Service Updated**: `app/services/transcription.service.ts` - Integrated mock provider
4. ✅ **Environment Updated**: `.env` and `.env.template` - Added `USE_MOCK_TRANSCRIPTION`
5. ✅ **Documentation**: `MOCK_MODE.md` - Full guide

## 🎭 How to Enable Mock Mode

### Step 1: Edit .env File

Open `C:\Users\Renato\repos\lbt\video-transcription\.env` and set:

```env
USE_MOCK_TRANSCRIPTION=true
```

### Step 2: Restart the Service

**IMPORTANT**: You MUST completely stop and restart the service for changes to take effect.

```bash
# Stop all instances of the service
# Then start fresh:
cd C:\Users\Renato\repos\lbt\video-transcription
npm run start
```

### Step 3: Verify Mock Mode is Active

You should see this in the startup logs:

```
🎭 Initializing MOCK transcription provider (no API charges)
```

**NOT this:**
```
Initializing transcription provider: google  ← Wrong! Mock mode not active
```

## 🚀 Quick Test

Once mock mode is active:

```bash
# Delete old test data
mongosh "mongodb://localhost:27017/mdr-video-transcriptions" --eval "db.getCollection('video-transcriptions').deleteMany({videoId: 'rBG1Lty78lI'})"

# Start a transcription
curl -X POST http://localhost:3016/transcription/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "youtubeUrl": "https://www.youtube.com/watch?v=rBG1Lty78lI",
    "language": "en-US"
  }'

# Wait 5-10 seconds, then check status
curl http://localhost:3016/transcription/status/TRANSCRIPT_ID

# Should complete in ~3 seconds instead of 8+ minutes!
```

## 💰 Cost Savings

| Mode | Cost per Video | Time |
|------|----------------|------|
| **Mock** | **$0.00** ⭐ | ~3 seconds |
| Google | $0.95 | ~8 minutes |
| OpenAI | $0.24 | ~5 minutes |

## 🎯 What Mock Mode Does

✅ **Still performs:**
- YouTube video download
- Audio format conversion (FFmpeg)
- Progress tracking (10% → 30% → 50% → 90% → 100%)
- MongoDB storage

❌ **Skip expensive step:**
- No Google Cloud Speech-to-Text API call ($$$)
- No OpenAI Whisper API call ($$$)
- Generates realistic fake transcripts instead

## 📝 Mock Transcript Types

The service randomly generates one of 4 transcript types:
1. **Chess Tutorial** - Opening strategies and tactics
2. **Educational Content** - Lesson-style content
3. **Tech Tutorial** - Coding and development
4. **Academic Lecture** - Scholarly content

All transcripts are **realistic** (500-1000 words) with proper formatting.

## 🔧 Troubleshooting

### Mock mode not working?

1. **Check .env file** has `USE_MOCK_TRANSCRIPTION=true`
2. **Kill ALL service instances** completely
3. **Start fresh** with `npm run start`
4. **Look for the 🎭 emoji** in startup logs

### Still seeing Google Cloud logs?

The service is NOT in mock mode. Repeat steps above carefully.

### Want to customize mock transcripts?

Edit: `app/services/mock-transcription.service.ts`
- Add new transcript templates
- Modify existing ones
- Change processing delay (default: 1-3 seconds)

## 🔄 Switching Back to Real APIs

When ready for production:

```env
USE_MOCK_TRANSCRIPTION=false
```

Restart the service and it will use Google/OpenAI again.

## 📚 Full Documentation

See `MOCK_MODE.md` for complete details, examples, and advanced usage.

---

**Remember**: The service MUST be fully restarted for environment changes to take effect!
