# YouTube Data API v3 Setup Guide

## Why Use YouTube Data API v3?

YouTube Data API v3 is the **official Google API** for accessing YouTube data, including captions/subtitles. It's the best solution for transcription because:

### ✅ Advantages

1. **No Bot Detection**: Official API, no "Sign in to confirm you're not a bot" errors
2. **Fastest**: Captions are already created by YouTube - instant download
3. **Cheapest**:
   - FREE quota: 10,000 units/day (enough for ~200 videos)
   - Caption downloads: Only 50 units per video
   - Compare to: Speech-to-Text ($0.006/min) or Whisper API ($0.006/min)
4. **Better Quality**: Many videos have professional human-created captions
5. **Multiple Languages**: Access captions in different languages
6. **No Infrastructure**: No audio download, conversion, or transcription needed

### ⚠️ Limitations

1. **Captions Must Exist**: Not all videos have captions/subtitles
2. **Quota Limits**: Free tier has daily limits (10,000 units)
3. **API Key Required**: Need Google Cloud account and API key

### 💡 How It Works

```
┌─────────────────────────────────────────────────────┐
│                YouTube Video Request                │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│   Step 1: Try YouTube Data API (if configured)     │
│   ✓ Download captions in SRT format                │
│   ✓ Convert to plain text                          │
│   ✓ Save to database                               │
│   ✓ DONE! (< 2 seconds)                           │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ If no captions...
                  ▼
┌─────────────────────────────────────────────────────┐
│   Step 2: Fallback to Audio Download               │
│   1. Download audio from YouTube (yt-dlp + cookies) │
│   2. Convert to WAV format                          │
│   3. Transcribe with Speech-to-Text/Whisper        │
│   4. Save to database                              │
│   5. DONE! (30-120 seconds)                        │
└─────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Create Google Cloud Project (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Note your Project ID

### 2. Enable YouTube Data API v3 (2 minutes)

1. Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
2. Search for "YouTube Data API v3"
3. Click **Enable**
4. Wait for activation (usually instant)

### 3. Create API Key (3 minutes)

1. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ CREATE CREDENTIALS** → **API key**
3. Copy the generated API key
4. Click **Edit API key** to restrict it (recommended):
   - **Application restrictions**: None (for server-side use)
   - **API restrictions**: Restrict key → Select "YouTube Data API v3"
   - **Save**

### 4. Configure the Service

#### For Local Development:

```bash
# Add to video-transcription/.env
YOUTUBE_API_KEY=AIzaSyD...your_api_key_here
```

#### For Production (Kubernetes):

```bash
# Method 1: Using kubectl (quick test)
kubectl set env deployment/video-transcription YOUTUBE_API_KEY=AIzaSyD...your_api_key_here

# Method 2: Using Helm values (recommended for permanent config)
# Add to video-transcription/helm/values.yaml
env:
  YOUTUBE_API_KEY: "AIzaSyD...your_api_key_here"

# Then redeploy
helm upgrade video-transcription ./helm \
  --set=image.tag=latest \
  --install
```

### 5. Test the Configuration

```bash
# Test with a video that has captions (most popular videos do)
node test-production.js https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

#### Expected Output:

```
✓ YouTube Data API v3 enabled - will try captions first
🎬 Step 1: Trying to fetch captions from YouTube API...
✓ Captions found! Converting SRT to plain text...
✓ Transcription completed using captions: 673abc...
  Words: 853
  Length: 4521 characters
  Provider: youtube-api-captions
```

## Quota Management

### Understanding Quota Units

YouTube Data API uses a quota system:
- **Daily Quota**: 10,000 units (free tier)
- **Caption List**: 50 units per request
- **Caption Download**: 200 units per request (but we use a workaround that's only ~50 units)

### Quota Calculator

```
Captions per Video: ~50 units
Daily Limit: 10,000 units
Videos per Day: 10,000 / 50 = 200 videos/day (generous!)
```

### Monitoring Quota Usage

1. Go to [Google Cloud Console > APIs & Services > Dashboard](https://console.cloud.google.com/apis/dashboard)
2. Select "YouTube Data API v3"
3. View quota usage graphs
4. Set up alerts for quota limits

### What Happens When Quota Exceeded?

The service automatically falls back to audio download:

```
⚠️  YouTube API quota exceeded - will fall back to audio download
Step 1: Downloading audio...
```

## Troubleshooting

### Error: "The request cannot be completed because you have exceeded your quota"

**Solution**:
- Wait for quota reset (midnight Pacific Time)
- Or increase quota (paid tier, or request increase)
- Service will automatically use audio download fallback

### Error: "API key not valid"

**Causes**:
1. API key not created correctly
2. YouTube Data API v3 not enabled
3. API key restrictions too strict

**Solution**:
1. Check API key in Google Cloud Console
2. Verify YouTube Data API v3 is enabled
3. Check API restrictions allow YouTube Data API v3

### Error: "Access Not Configured"

**Solution**: Enable YouTube Data API v3 in Google Cloud Console

### Logs Show: "⚠️ YouTube Data API v3 not configured"

**Solution**: Set `YOUTUBE_API_KEY` environment variable

### Logs Show: "⚠️ No captions available - falling back to audio download"

**This is normal!** Not all videos have captions. The service will:
1. Try captions first
2. Fall back to audio download automatically
3. Complete the transcription successfully

## Cost Comparison

### With YouTube Data API (Recommended)

| Component | Cost per Video | Notes |
|-----------|---------------|-------|
| Captions | FREE (50 units) | Within 10,000 daily quota |
| Fallback Audio | $0.006-0.012 | Only if no captions |
| **Average** | **~$0.001** | 90% of popular videos have captions |

### Without YouTube Data API (Audio Only)

| Component | Cost per Video | Notes |
|-----------|---------------|-------|
| Audio Download | FREE | But hits bot detection |
| Audio Transcription | $0.006-0.012 | Google Speech or OpenAI Whisper |
| **Average** | **~$0.009** | Every video |

### Savings: ~90% cost reduction + faster + no bot detection!

## Security Best Practices

### ✅ Do:
- Store API key in environment variables
- Use API key restrictions (YouTube Data API v3 only)
- Set up quota alerts
- Rotate API keys periodically
- Use separate keys for dev/prod

### ❌ Don't:
- Commit API key to git
- Share API key publicly
- Use same key for multiple projects
- Expose API key in client-side code

## Advanced Configuration

### Using OAuth 2.0 Instead of API Key

For production with higher quota needs:

```typescript
// In youtube-api.service.ts constructor:
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/youtube.readonly']
});

this.youtube = google.youtube({
  version: 'v3',
  auth: auth
});
```

### Requesting Quota Increase

1. Go to [Google Cloud Console > APIs & Services > Quotas](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)
2. Find "Queries per day"
3. Click **EDIT QUOTAS**
4. Request increase (usually approved within 24-48 hours)
5. Free tier can often get 50,000-100,000 units/day

## Fallback Strategy

The service implements a smart 3-tier fallback:

```
1st Attempt: YouTube API Captions (if API key configured)
     ↓ (if no captions or quota exceeded)
2nd Attempt: Audio Download with Browser Cookies
     ↓ (if cookies not working)
3rd Attempt: Audio Download with Enhanced Headers
```

This ensures maximum reliability and success rate!

## References

- [YouTube Data API v3 Documentation](https://developers.google.com/youtube/v3)
- [Captions API Reference](https://developers.google.com/youtube/v3/docs/captions)
- [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [API Console](https://console.cloud.google.com/apis/credentials)
