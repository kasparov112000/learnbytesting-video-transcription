# Self-Hosted Whisper Transcription

## Overview
Run OpenAI's Whisper model on your own infrastructure to eliminate API costs (95% cost savings).

## Cost Analysis

### Current API Costs (40-minute video):
- Google Cloud: **$0.95**
- OpenAI API: **$0.24**

### Self-Hosted Costs (40-minute video):
- **Compute**: ~$0.02-0.05 (GPU) or ~$0.10 (CPU)
- **Storage**: ~$0.001 (temporary)
- **Total**: **~$0.05** or less

**Annual Savings** (1000 videos/year):
- vs Google: Save **$950** per year
- vs OpenAI API: Save **$240** per year

## Deployment Options

### Option 1: Python Whisper Service (Easiest)

Create a simple Flask/FastAPI service that runs Whisper:

```python
# whisper-service/app.py
from flask import Flask, request, jsonify
import whisper
import os

app = Flask(__name__)

# Load model once at startup (small, base, medium, or large)
model = whisper.load_model("base")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    audio_file = request.files['audio']
    audio_path = f"/tmp/{audio_file.filename}"
    audio_file.save(audio_path)

    # Transcribe
    result = model.transcribe(audio_path, language='en')

    # Cleanup
    os.remove(audio_path)

    return jsonify({
        'transcript': result['text'],
        'segments': result['segments']
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

**Deploy on**:
- Your existing Node.js server
- Separate Python container
- DigitalOcean Droplet ($20/month with GPU)
- AWS EC2 (g4dn.xlarge ~$0.50/hour)

### Option 2: Whisper.cpp (Faster, C++)

Much faster implementation in C++:

```bash
# Install whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make

# Download model
bash ./models/download-ggml-model.sh base

# Transcribe
./main -m models/ggml-base.bin -f audio.wav
```

**Benefits**:
- 4x faster than Python version
- Lower memory usage
- Works great on CPU
- Can run on your existing server

### Option 3: Docker Container

```dockerfile
# Dockerfile
FROM python:3.9

RUN pip install openai-whisper flask

WORKDIR /app
COPY whisper-service.py .

CMD ["python", "whisper-service.py"]
```

```bash
# Build and run
docker build -t whisper-service .
docker run -p 5000:5000 whisper-service
```

### Option 4: Faster-Whisper (Optimized)

Even faster implementation using CTranslate2:

```python
from faster_whisper import WhisperModel

# Load model (runs 4x faster than original)
model = WhisperModel("base", device="cpu", compute_type="int8")

segments, info = model.transcribe("audio.mp3", language="en")

transcript = " ".join([segment.text for segment in segments])
```

**Speed**: Up to 4x faster than original Whisper!

## Model Sizes & Performance

| Model | Size | Speed (CPU) | Speed (GPU) | Quality |
|-------|------|-------------|-------------|---------|
| tiny | 75 MB | 10x faster | Real-time | Good for simple audio |
| base | 142 MB | 5x faster | Real-time | **Recommended for testing** |
| small | 466 MB | 2x faster | Real-time | Very good |
| medium | 1.5 GB | 1x (normal) | Real-time | Excellent |
| large | 2.9 GB | Slow | Real-time | Best quality |

**Recommendation**: Start with **base** model for development, upgrade to **medium** for production.

## Integration with Your Microservice

### Step 1: Add Whisper Service

```typescript
// app/services/self-hosted-whisper.service.ts
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

export class SelfHostedWhisperService {
  private whisperUrl: string;

  constructor() {
    // URL of your Whisper service (Python Flask, Docker, etc.)
    this.whisperUrl = process.env.WHISPER_SERVICE_URL || 'http://localhost:5000';
    console.log(`Self-hosted Whisper service: ${this.whisperUrl}`);
  }

  async transcribe(audioFilePath: string, language: string): Promise<string> {
    try {
      console.log(`Transcribing with self-hosted Whisper: ${audioFilePath}`);

      const formData = new FormData();
      formData.append('audio', fs.createReadStream(audioFilePath));
      formData.append('language', language.split('-')[0]); // 'en-US' -> 'en'

      const response = await axios.post(`${this.whisperUrl}/transcribe`, formData, {
        headers: formData.getHeaders(),
        timeout: 600000 // 10 minutes
      });

      const transcript = response.data.transcript;
      console.log(`✓ Self-hosted transcription completed: ${transcript.length} characters`);

      return transcript;
    } catch (error: any) {
      console.error('Self-hosted Whisper error:', error.message);
      throw new Error(`Self-hosted Whisper transcription failed: ${error.message}`);
    }
  }
}
```

### Step 2: Update Configuration

```typescript
// config/global.config.ts
transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER || 'google',
// Options: 'google', 'openai', 'mock', 'self-hosted'

// Self-hosted Whisper configuration
whisperServiceUrl: process.env.WHISPER_SERVICE_URL || 'http://localhost:5000',
```

### Step 3: Update .env

```env
TRANSCRIPTION_PROVIDER=self-hosted
WHISPER_SERVICE_URL=http://localhost:5000
```

## Deployment Strategies

### Strategy 1: Same Server (Simple)

Run Whisper on your existing Node.js server:
- **Pros**: No additional infrastructure
- **Cons**: May slow down main app during transcription
- **Cost**: $0 extra

### Strategy 2: Separate Worker (Recommended)

Run Whisper on a separate server/container:
- **Pros**: Doesn't affect main app, can scale independently
- **Cons**: Need extra server
- **Cost**: $5-20/month (DigitalOcean/Linode)

### Strategy 3: GPU Instance (Fastest)

Use GPU for lightning-fast transcription:
- **Pros**: Real-time transcription (40 min video = 40 min processing)
- **Cons**: More expensive infrastructure
- **Cost**: ~$50-100/month, but worth it at scale

### Strategy 4: Queue System (Scalable)

Use job queue for batch processing:
- Add jobs to queue (Redis/RabbitMQ)
- Worker processes jobs one at a time
- Can scale workers up/down based on load

## Quick Setup Guide

### 1. Install Whisper Locally (Test)

```bash
# Install Python and Whisper
pip install openai-whisper

# Test it
whisper test-audio.mp3 --language English --model base
```

### 2. Create Simple Service

```python
# whisper-service.py
from flask import Flask, request, jsonify
import whisper
import tempfile
import os

app = Flask(__name__)
model = whisper.load_model("base")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    file = request.files['audio']

    # Save temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        file.save(tmp.name)

        # Transcribe
        result = model.transcribe(tmp.name)

        # Cleanup
        os.unlink(tmp.name)

        return jsonify({'transcript': result['text']})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### 3. Run Service

```bash
python whisper-service.py
```

### 4. Test It

```bash
curl -X POST http://localhost:5000/transcribe \
  -F "audio=@test-audio.wav"
```

## Performance Benchmarks

**40-minute video transcription times:**

| Setup | Time | Cost |
|-------|------|------|
| **CPU (base model)** | 3-4 hours | $0.10 |
| **CPU (tiny model)** | 30 minutes | $0.03 |
| **GPU (base model)** | 40 minutes | $0.05 |
| **GPU (medium model)** | 60 minutes | $0.08 |
| **OpenAI API** | 5 minutes | $0.24 |
| **Google Cloud** | 8 minutes | $0.95 |

## Recommended Setup for Production

```
1. DigitalOcean Droplet ($20/month)
   - 4 CPU cores
   - 8GB RAM
   - Run whisper.cpp with base model
   - Process 10-15 videos/day

2. For High Volume:
   - GPU instance ($50-100/month)
   - Run faster-whisper with medium model
   - Process 100+ videos/day

3. For Testing:
   - Run on existing server
   - Use tiny or base model
   - Free!
```

## Pros & Cons

### ✅ Pros:
- **95% cost savings** at scale
- No API rate limits
- Full control over processing
- Works offline
- No vendor lock-in
- Same quality as OpenAI API

### ❌ Cons:
- Need to manage infrastructure
- Slower than APIs (unless GPU)
- Initial setup complexity
- Need Python/Docker knowledge

## When to Use Self-Hosted

**Use self-hosted if:**
- ✅ Transcribing 100+ hours/month (saves $100+/month)
- ✅ Have technical resources to maintain
- ✅ Want full control over data
- ✅ Need to work offline
- ✅ Budget-conscious

**Use APIs if:**
- ❌ Low volume (<10 hours/month)
- ❌ Need fastest processing
- ❌ Don't want to manage infrastructure
- ❌ Just starting out

## Next Steps

Want me to:
1. ✅ Create the Python Whisper service?
2. ✅ Set up Docker container?
3. ✅ Integrate with your Node.js microservice?
4. ✅ Deploy to your infrastructure?

Let me know and I'll implement it!

## Alternative: Hybrid Approach

Use **both**:
- Self-hosted for testing/dev (free)
- API for production (fast, reliable)

Just switch the `TRANSCRIPTION_PROVIDER` environment variable!
