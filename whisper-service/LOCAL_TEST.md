# Local Whisper Service Testing Guide

## Quick Start

### 1. Start the Whisper Service

```bash
cd /home/hipolito/repos/lbt/video-transcription/whisper-service
python3 whisper-service.py
```

Expected output:
```
Loading Whisper model: base
✓ Whisper model 'base' loaded successfully
 * Serving Flask app 'whisper-service'
 * Debug mode: off
Starting Whisper service on port 5000
WARNING: This is a development server. Do not use it in a production deployment.
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.x.x:5000
```

**Note**: First time will take 1-2 minutes to download the base model (~142MB)

### 2. Test the Health Endpoint

Open a new terminal:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "model": "base",
  "status": "ok",
  "timestamp": "2025-11-21T10:30:00.000000"
}
```

### 3. Test Transcription (Optional)

If you have an audio file:

```bash
curl -X POST http://localhost:5000/transcribe \
  -F "audio=@/path/to/audio.wav" \
  -F "language=en"
```

Expected response:
```json
{
  "duration": 12.5,
  "language": "en",
  "model": "base",
  "segments": 3,
  "transcript": "This is the transcribed text from the audio file."
}
```

## Testing with Video Transcription Service

### 1. Keep Whisper Service Running

Leave the terminal with Whisper service running.

### 2. Update Video Transcription .env

Already configured in `.env`:
```env
TRANSCRIPTION_PROVIDER=self-hosted
WHISPER_SERVICE_URL=http://localhost:5000
```

### 3. Start Video Transcription Service

In another terminal:

```bash
cd /home/hipolito/repos/lbt/video-transcription
npm start
```

Expected output should show:
```
✓ Self-hosted Whisper configured: http://localhost:5000
```

### 4. Test End-to-End

The video-transcription service will now use your local Whisper service for transcriptions.

## Troubleshooting

### Issue: "Cannot connect to Whisper service"

**Solution**:
1. Make sure Whisper service is running on port 5000
2. Check with: `curl http://localhost:5000/health`
3. Look for firewall blocking localhost connections

### Issue: "Model loading too slow"

**Solution**: First download is slow. Wait for it to complete once, then it's cached.

Model location: `~/.cache/whisper/`

### Issue: "Out of memory"

**Solution**: Use smaller model:

```bash
export WHISPER_MODEL=tiny
python3 whisper-service.py
```

Model sizes:
- `tiny`: 75MB, fastest, good quality
- `base`: 142MB, recommended (default)
- `small`: 466MB, excellent quality
- `medium`: 1.5GB, best quality

### Issue: Transcription takes too long

**Solutions**:
1. **Use tiny model** (10x faster):
   ```bash
   export WHISPER_MODEL=tiny
   python3 whisper-service.py
   ```

2. **Check CPU usage**:
   ```bash
   htop  # Look for python3 process
   ```

3. **Expected times** (40-min video):
   - tiny model: ~30 minutes
   - base model: ~60-90 minutes
   - On this device (Jetson/ARM): May be slower than x86 CPU

## Performance Tips

### 1. Use the Right Model

For development/testing: **tiny** or **base**
For production: **base** or **small**

### 2. Monitor Resources

```bash
# CPU and memory
htop

# Disk space (models are cached)
du -sh ~/.cache/whisper/
```

### 3. Process During Off-Hours

For long videos, start transcription overnight.

## Next Steps

Once local testing works:
1. ✅ Build Docker image
2. ✅ Deploy to DigitalOcean K8s
3. ✅ Update video-transcription to use K8s service URL

See `/whisper-service/README.md` for K8s deployment.
