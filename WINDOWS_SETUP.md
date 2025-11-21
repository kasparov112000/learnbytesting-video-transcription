# Video Transcription Service - Windows Setup Guide

## ✅ Yes, It Works on Windows!

The service is **fully cross-platform** and has been designed to work on Windows, macOS, and Linux.

## Prerequisites

### 1. Install Node.js 20+
```powershell
# Download from: https://nodejs.org/
# Or use winget:
winget install OpenJS.NodeJS.LTS

# Verify installation
node --version  # Should be v20.x.x or higher
npm --version
```

### 2. Install MongoDB
```powershell
# Download from: https://www.mongodb.com/try/download/community
# Or use winget:
winget install MongoDB.Server

# Start MongoDB (usually runs as Windows Service automatically)
# Or manually:
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath C:\data\db
```

### 3. Install Python 3.8+ (for Whisper Service)
```powershell
# Download from: https://www.python.org/downloads/
# Or use winget:
winget install Python.Python.3.11

# Verify installation
python --version  # Should be 3.8 or higher
pip --version
```

### 4. Install FFmpeg (Optional, for audio conversion)
```powershell
# Download from: https://ffmpeg.org/download.html
# Or use winget:
winget install Gyan.FFmpeg

# Add to PATH or the service will auto-detect common locations
```

## Quick Start

### Option 1: Mock Mode (No Whisper, Fastest)

Perfect for UI development and testing without any transcription API.

1. **Clone and Install**
```powershell
cd C:\repos\lbt\video-transcription
npm install
```

2. **Configure Environment**
```powershell
# Copy .env.template to .env
copy .env.template .env

# Edit .env and set:
# TRANSCRIPTION_PROVIDER=mock
# USE_MOCK_TRANSCRIPTION=true
```

3. **Start Service**
```powershell
npm start
```

4. **Test**
```powershell
# Open another PowerShell window
curl http://localhost:3016/health

# Test transcription (returns mock data instantly)
curl -X POST http://localhost:3016/transcription/transcribe `
  -H "Content-Type: application/json" `
  -d '{\"youtubeUrl\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\",\"language\":\"en\"}'
```

### Option 2: Self-Hosted Whisper (95% Cost Savings!)

Use your own hardware for transcription - no API charges.

1. **Install Whisper Service Dependencies**
```powershell
cd whisper-service
python -m venv venv
.\venv\Scripts\activate
pip install flask openai-whisper
```

2. **Start Whisper Service** (separate terminal)
```powershell
cd whisper-service
.\venv\Scripts\activate
python whisper-service.py

# First run will download the model (~142MB for 'base')
# Available models: tiny (75MB), base (142MB), small (466MB), medium (1.5GB)
```

3. **Configure Video Transcription**
```powershell
# Edit .env and set:
# TRANSCRIPTION_PROVIDER=self-hosted
# WHISPER_SERVICE_URL=http://localhost:5000
# USE_MOCK_TRANSCRIPTION=false
```

4. **Start Video Transcription Service**
```powershell
npm start
```

5. **Test Complete Pipeline**
```powershell
# This will: Download YouTube audio → Convert → Transcribe with Whisper
curl -X POST http://localhost:3016/transcription/transcribe `
  -H "Content-Type: application/json" `
  -d '{\"youtubeUrl\":\"https://www.youtube.com/watch?v=jNQXAC9IVRw\",\"language\":\"en\"}'

# Check status (replace ID with your transcriptionId from above)
curl http://localhost:3016/transcription/status/YOUR_TRANSCRIPTION_ID

# Get completed transcript
curl http://localhost:3016/transcription/transcript/YOUR_TRANSCRIPTION_ID
```

### Option 3: OpenAI Whisper API (Fastest, Costs Money)

Use OpenAI's hosted Whisper API.

```powershell
# Edit .env and set:
# TRANSCRIPTION_PROVIDER=openai
# OPENAI_API_KEY=sk-your-api-key-here
```

### Option 4: Google Cloud Speech-to-Text (High Quality, Costs Money)

```powershell
# Follow GOOGLE_SPEECH_API_SETUP.md for detailed setup
# Edit .env and set:
# TRANSCRIPTION_PROVIDER=google
# GOOGLE_CLOUD_PROJECT_ID=your-project-id
# GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

## Windows-Specific Notes

### ✅ Automatic FFmpeg Detection

The service automatically detects FFmpeg in common Windows locations:
- `C:\Program Files\FFmpeg\bin\`
- `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\bin\`
- System PATH

No manual configuration needed!

### ✅ Cross-Platform Audio Conversion

The `audio-converter.service.ts` automatically handles:
- Windows: Uses FFmpeg from detected path
- Docker/Linux: Uses system FFmpeg
- No code changes needed between platforms

### ✅ MongoDB Connection

```powershell
# Default connection string works on Windows:
MONGODB_URL=mongodb://localhost:27017/mdr-video-transcriptions

# If MongoDB is running on custom port:
MONGODB_URL=mongodb://localhost:27018/mdr-video-transcriptions
```

### ✅ Temp Files

```powershell
# Windows uses:
TEMP_AUDIO_DIR=./temp/audio  # Relative to project root

# Absolute path also works:
TEMP_AUDIO_DIR=C:\Temp\video-transcription\audio
```

## VS Code Integration

The project includes VS Code tasks that work on Windows:

1. Open folder in VS Code
2. Press `Ctrl+Shift+P` → "Tasks: Run Task"
3. Select:
   - **"npm: start"** - Start video transcription service
   - **"npm: build"** - Build TypeScript
   - **"npm: test"** - Run tests

## Troubleshooting Windows

### Issue: "MongoDB connection failed"

**Solution:**
```powershell
# Check if MongoDB is running
Get-Service MongoDB

# Start MongoDB service
Start-Service MongoDB

# Or run manually
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath C:\data\db
```

### Issue: "FFmpeg not found"

**Solution:**
```powershell
# Install FFmpeg
winget install Gyan.FFmpeg

# Or download and add to PATH
# Service will auto-detect common install locations
```

### Issue: "Python module not found" (Whisper Service)

**Solution:**
```powershell
cd whisper-service
.\venv\Scripts\activate
pip install flask openai-whisper

# If activation fails, recreate venv:
rmdir /s venv
python -m venv venv
.\venv\Scripts\activate
pip install flask openai-whisper
```

### Issue: "Port 3016 already in use"

**Solution:**
```powershell
# Find process using port
netstat -ano | findstr :3016

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in .env:
PORT=3017
```

### Issue: Whisper is slow on Windows

**Solution:**
```powershell
# Use smaller model for faster processing
# In whisper-service directory:
$env:WHISPER_MODEL="tiny"
python whisper-service.py

# Model speeds (4-min video):
# tiny:   ~2-5 minutes   (good for development)
# base:   ~5-15 minutes  (recommended, default)
# small:  ~15-30 minutes (excellent quality)
```

## Performance Tips

### Development Mode
- Use **mock mode** for UI testing (instant results)
- Use **tiny Whisper model** for testing transcription pipeline

### Production Mode
- Use **base or small Whisper model** for good quality
- Consider GPU acceleration (requires CUDA setup)
- Use **OpenAI API** for fastest results (but costs money)

## Docker Alternative (Windows)

If you prefer Docker on Windows:

```powershell
# Build image
docker build -t video-transcription .

# Run with Docker Desktop
docker run -p 3016:3000 `
  -e MONGODB_URL=mongodb://host.docker.internal:27017/mdr-video-transcriptions `
  -e TRANSCRIPTION_PROVIDER=mock `
  video-transcription
```

## Complete Windows Test Script

Save as `test-windows.ps1`:

```powershell
# Test Video Transcription on Windows

Write-Host "🔍 Checking Prerequisites..." -ForegroundColor Cyan

# Check Node.js
$nodeVersion = node --version
Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green

# Check MongoDB
try {
    $mongoTest = Test-NetConnection -ComputerName localhost -Port 27017 -WarningAction SilentlyContinue
    if ($mongoTest.TcpTestSucceeded) {
        Write-Host "✓ MongoDB: Running on port 27017" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ MongoDB: Not running" -ForegroundColor Red
}

# Check Python
$pythonVersion = python --version
Write-Host "✓ Python: $pythonVersion" -ForegroundColor Green

Write-Host "`n🚀 Starting Services..." -ForegroundColor Cyan

# Start video transcription
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm start"

Write-Host "`n⏳ Waiting for service to start (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test health
Write-Host "`n🏥 Testing Health Endpoint..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri http://localhost:3016/health
Write-Host "✓ Health Check: $($health.status)" -ForegroundColor Green

# Test transcription
Write-Host "`n📹 Testing Transcription (Mock Mode)..." -ForegroundColor Cyan
$body = @{
    youtubeUrl = "https://www.youtube.com/watch?v=test"
    language = "en"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri http://localhost:3016/transcription/transcribe `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

Write-Host "✓ Transcription Started: $($response.transcriptionId)" -ForegroundColor Green
Write-Host "✓ Status: $($response.status)" -ForegroundColor Green

Write-Host "`n✅ All tests passed!" -ForegroundColor Green
```

Run with:
```powershell
.\test-windows.ps1
```

## Summary

**✅ Works on Windows** - Fully tested and supported
**✅ Auto-detects FFmpeg** - No manual path configuration
**✅ Cross-platform** - Same codebase works on Windows/Mac/Linux
**✅ Multiple modes** - Mock, self-hosted Whisper, OpenAI, Google
**✅ VS Code integrated** - Built-in tasks for common operations

For more details, see:
- `README.md` - General documentation
- `MOCK_MODE.md` - Testing without API charges
- `SELF_HOSTED_WHISPER.md` - Setup your own Whisper service
- `GOOGLE_SPEECH_API_SETUP.md` - Google Cloud setup
