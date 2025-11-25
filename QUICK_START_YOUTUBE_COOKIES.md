# Quick Start: Fix YouTube Bot Detection in Production

## What We Fixed

✅ **Removed deprecated yt-dlp options** that were causing warnings
✅ **Added browser cookie support** for local development
✅ **Configured Kubernetes Secret mount** for production cookies
✅ **Created automated setup script** for easy deployment

## Current Status

⚠️ **YouTube Shorts are still blocked** because production needs actual cookies file

The error you're seeing:
```
Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies
```

This happens because:
- Production runs in a Docker container (no browsers available)
- `YOUTUBE_COOKIES_BROWSER` only works where browsers are installed
- We need to provide a **cookies file** via Kubernetes Secret

## Next Steps (5 minutes)

### 1. Export YouTube Cookies (2 min)

On your **local Windows machine**:

1. Install Chrome extension: [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. Login to YouTube in Chrome
3. Go to https://www.youtube.com
4. Click the extension icon → "Export"
5. Save as `youtube-cookies.txt` in `video-transcription/` folder

### 2. Create Kubernetes Secret (1 min)

```bash
cd video-transcription

# Make script executable (Git Bash)
chmod +x setup-youtube-cookies.sh

# Run setup script
./setup-youtube-cookies.sh
```

The script will:
- ✓ Create Kubernetes secret from your cookies file
- ✓ Restart the deployment
- ✓ Wait for the pod to be ready
- ✓ Verify everything is working

### 3. Test (1 min)

```bash
# Test with YouTube Shorts (the one that's currently failing)
node test-production.js https://www.youtube.com/shorts/92SmJPHa8xI
```

You should see:
- ✅ No bot detection errors
- ✅ Video downloads successfully
- ✅ Transcription completes

## What the Deployment Does

The updated Kubernetes deployment:
1. Mounts `youtube-cookies` Secret as `/etc/youtube/cookies.txt`
2. Sets `YOUTUBE_COOKIES_FILE=/etc/youtube/cookies.txt`
3. Service automatically uses cookies for all YouTube downloads

## Troubleshooting

### "cookies.txt not found"
- Make sure you saved the cookies file in the `video-transcription/` directory
- File must be named exactly: `youtube-cookies.txt`

### "Cannot connect to Kubernetes"
- Run: `doctl kubernetes cluster kubeconfig save YOUR_CLUSTER_ID`
- Or use the cluster connection commands

### Still getting bot errors
- Cookies might have expired (re-export from browser)
- Check logs: `kubectl logs -l app=video-transcription --tail=50`
- Should see: `Using YouTube cookies from file: /etc/youtube/cookies.txt`

## Security Notes

🔒 The cookies file is stored as a Kubernetes Secret (encrypted at rest)
🔒 The file is `.gitignore`d to prevent accidental commits
🔒 Only the video-transcription pod can access the secret

## Manual Setup (Alternative)

If you prefer manual setup instead of the script:

```bash
# Create secret manually
kubectl create secret generic youtube-cookies \
  --from-file=cookies.txt=./youtube-cookies.txt

# Restart deployment
kubectl rollout restart deployment/video-transcription

# Wait for ready
kubectl rollout status deployment/video-transcription
```

## After Setup

Once cookies are configured, YouTube downloads will work for:
- ✅ Standard videos
- ✅ YouTube Shorts
- ✅ Age-restricted videos
- ✅ Region-locked content (if your account has access)

## Cookie Maintenance

YouTube cookies typically last **1-2 weeks**. When they expire:
1. Re-export cookies from your browser
2. Run `./setup-youtube-cookies.sh` again
3. It will replace the old secret automatically

Set a reminder to refresh cookies weekly to avoid interruptions.
