# ✅ Local Testing Setup - SUCCESS!

## 🎉 What's Running

### 1. Whisper Service (Port 5000)
- **Status**: ✅ Running
- **Model**: tiny (75MB - fastest for testing)
- **URL**: http://localhost:5000
- **Logs**: `/tmp/whisper-service.log`

**Test it:**
```bash
curl http://localhost:5000/health
# Response: {"model":"tiny","status":"ok","timestamp":"..."}
```

### 2. Video Transcription Service (Port 3016)
- **Status**: ✅ Running
- **Provider**: self-hosted (connected to Whisper)
- **URL**: http://localhost:3016
- **Logs**: `/tmp/video-transcription.log`

**Test it:**
```bash
curl http://localhost:3016/health
# Response: {"status":"ok","service":"video-transcription","timestamp":"..."}
```

### 3. Integration
- ✅ Video transcription service successfully connected to Whisper
- ✅ Using self-hosted Whisper for 95% cost savings

---

## 📊 Service Status

```
Whisper Service (Python)
  ├─ Port: 5000
  ├─ Model: tiny
  ├─ Status: Ready
  └─ Health: http://localhost:5000/health

Video Transcription (Node.js)
  ├─ Port: 3016
  ├─ Provider: self-hosted
  ├─ Status: Ready
  ├─ Health: http://localhost:3016/health
  └─ Connected to: http://localhost:5000 ✅
```

---

## 🎬 Testing Video Transcription

### Option 1: Test with Mock Mode (Quickest)

```bash
# Stop current services
pkill -f whisper-service
pkill -f ts-node-dev

# Update .env to use mock
cd /home/hipolito/repos/lbt/video-transcription
cat > .env << 'EOF'
ENV_NAME=LOCAL
PORT=3016
MONGODB_URL=mongodb://localhost:27017/mdr-video-transcriptions
TRANSCRIPTION_PROVIDER=mock
USE_MOCK_TRANSCRIPTION=true
EOF

# Restart
npm start
```

Then test with any YouTube URL - it will return mock transcript instantly!

### Option 2: Test with Real Whisper (Slow but Real)

**Requirements**:
- YouTube URL of a SHORT video (< 5 minutes recommended)
- Patience (tiny model takes ~10-20 min for a 5-min video on ARM)

**API Endpoints** (check routes in `/app/routes/default.api.ts`):
```bash
# Example: Start transcription
curl -X POST http://localhost:3016/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID", "language": "en-US"}'

# Response: {"transcriptId": "..."}

# Check status
curl http://localhost:3016/api/transcribe/TRANSCRIPT_ID

# Get completed transcript
curl http://localhost:3016/api/transcribe/TRANSCRIPT_ID
```

---

## 🎛️ Managing Services

### View Logs

```bash
# Whisper service
tail -f /tmp/whisper-service.log

# Video transcription
tail -f /tmp/video-transcription.log
```

### Stop Services

```bash
# Stop all
pkill -f whisper-service
pkill -f ts-node-dev

# Or stop specific
kill $(pgrep -f whisper-service)
kill $(pgrep -f ts-node-dev)
```

### Restart Services

```bash
# Terminal 1: Start Whisper
cd /home/hipolito/repos/lbt/video-transcription/whisper-service
export WHISPER_MODEL=tiny
python3 whisper-service.py

# Terminal 2: Start Video Transcription
cd /home/hipolito/repos/lbt/video-transcription
npm start
```

---

## 🔧 Model Options

You can change the Whisper model for different speed/quality tradeoffs:

### Tiny (Current) - Best for Testing
```bash
export WHISPER_MODEL=tiny
python3 whisper-service.py
```
- Size: 75MB
- Speed: Fastest (10x faster than base)
- Quality: Good for clear audio
- **Use for**: Quick testing, development

### Base - Balanced (Recommended)
```bash
export WHISPER_MODEL=base
python3 whisper-service.py
```
- Size: 142MB
- Speed: Fast
- Quality: Very good
- **Use for**: Production, most use cases

### Small - High Quality
```bash
export WHISPER_MODEL=small
python3 whisper-service.py
```
- Size: 466MB
- Speed: Slower (2x slower than base)
- Quality: Excellent
- **Use for**: High-accuracy needs

---

## 📈 Performance Expectations

**5-minute video transcription:**

| Model | Time (ARM/Jetson) | Time (x86 CPU) | Quality |
|-------|------------------|----------------|---------|
| tiny  | ~10-15 min | ~3-5 min | Good |
| base  | ~20-30 min | ~5-10 min | Very Good |
| small | ~40-60 min | ~10-20 min | Excellent |

**Your device**: Appears to be ARM-based (Jetson), so expect slower times.

---

## 🚀 Next Steps

### 1. Test with Mock Mode ✅
Fastest way to test the full flow without waiting for transcription.

### 2. Test with Short Video ✅
Try a 1-2 minute YouTube video to verify real Whisper integration.

### 3. Deploy to Kubernetes 🎯
Once local testing is complete:

```bash
cd whisper-service

# Build Docker image
docker build -t kasparov112000/learnbytesting-whisper-service:latest .

# Push to DockerHub
docker push kasparov112000/learnbytesting-whisper-service:latest

# Deploy to K8s
kubectl apply -f k8s-deployment.yaml
```

See `/whisper-service/README.md` for detailed K8s deployment.

---

## 💡 Tips

### 1. Use Tiny Model for Development
Much faster feedback loop during development.

### 2. Test with Short Videos First
Don't start with a 40-minute video! Try 1-2 minutes first.

### 3. Monitor Resources
```bash
# CPU and memory usage
htop

# Watch for high CPU (expected during transcription)
```

### 4. Cache is Your Friend
Models are cached in `~/.cache/whisper/` after first download.

---

## 🐛 Troubleshooting

### Service won't start
```bash
# Check if port is in use
lsof -i :5000  # Whisper
lsof -i :3016  # Video transcription

# Kill and restart
pkill -f whisper-service
pkill -f ts-node-dev
```

### "Cannot connect to Whisper service"
```bash
# Verify Whisper is running
curl http://localhost:5000/health

# Check logs
cat /tmp/whisper-service.log
```

### Transcription too slow
```bash
# Use tiny model
export WHISPER_MODEL=tiny

# Or use mock mode for testing
USE_MOCK_TRANSCRIPTION=true
```

---

## 📚 Additional Resources

- **Local Testing Guide**: `/whisper-service/LOCAL_TEST.md`
- **K8s Deployment**: `/whisper-service/README.md`
- **Cost Analysis**: `/whisper-service/K8S_COST_ANALYSIS.md`
- **Self-Hosted Details**: `/video-transcription/SELF_HOSTED_WHISPER.md`

---

## ✨ Success Checklist

- [x] Python and pip installed
- [x] Whisper and Flask dependencies installed
- [x] Whisper service running on port 5000
- [x] Video transcription service running on port 3016
- [x] Services can communicate
- [ ] Test with YouTube video (optional)
- [ ] Deploy to Kubernetes (when ready)

---

**🎊 Congratulations! Your local self-hosted Whisper setup is complete!**

Ready to save 95% on transcription costs! 💰
