# Setting Up NVIDIA Jetson AGX Orin as Whisper Transcription Server

## Why Jetson AGX Orin is PERFECT for This

Your Jetson AGX Orin is actually **ideal** for running Whisper:

### Hardware Specs:
- **GPU**: NVIDIA Ampere with 2048 CUDA cores
- **Memory**: 32GB or 64GB unified memory
- **AI Performance**: 275 TOPS (Tera Operations Per Second)
- **Power**: Only 15-60W (vs 300W+ for desktop GPUs)
- **Cost**: Already paid for! 🎉

### Expected Performance:
| Model | Processing Speed | Quality |
|-------|-----------------|---------|
| **base** | **Real-time** (40 min video = 40 min) | Very Good ⭐ |
| **small** | **Real-time** | Excellent |
| **medium** | **Near real-time** (40 min = 50-60 min) | Excellent |
| **large** | 2-3x slower | Best |

**Recommendation**: Use **small** or **medium** model for best balance.

## Setup Overview

```
Home Network:
┌─────────────────────────────────────┐
│  Jetson AGX Orin (192.168.1.x)     │
│  ├─ Whisper Model (GPU-accelerated) │
│  ├─ Flask/FastAPI Service (Port 5000)│
│  └─ Docker Container (optional)      │
└─────────────────────────────────────┘
           ↓ (Internet)
┌─────────────────────────────────────┐
│  DigitalOcean/Cloud Server          │
│  ├─ Node.js Microservice (Port 3016)│
│  └─ Sends audio files to Jetson     │
└─────────────────────────────────────┘
```

## Step 1: Prepare Your Jetson

### 1.1 Check JetPack Version

```bash
# SSH into your Jetson
ssh your-user@jetson-ip

# Check JetPack version
sudo apt-cache show nvidia-jetpack
```

You need **JetPack 5.0+** for best PyTorch support.

### 1.2 Install Dependencies

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Python and pip
sudo apt install -y python3-pip python3-dev

# Install system dependencies
sudo apt install -y ffmpeg libportaudio2 libportaudiocpp0 portaudio19-dev
sudo apt install -y git wget curl
```

### 1.3 Install PyTorch (GPU-enabled)

```bash
# PyTorch for Jetson (pre-built wheels)
wget https://developer.download.nvidia.com/compute/redist/jp/v511/pytorch/torch-2.0.0+nv23.05-cp38-cp38-linux_aarch64.whl

pip3 install torch-2.0.0+nv23.05-cp38-cp38-linux_aarch64.whl

# Verify GPU is available
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
# Should print: CUDA available: True
```

### 1.4 Install Whisper

```bash
# Install OpenAI Whisper
pip3 install openai-whisper

# Install faster-whisper (recommended - 4x faster)
pip3 install faster-whisper

# Install Flask for API
pip3 install flask flask-cors
```

## Step 2: Create Whisper Service

### Option A: Simple Flask Service (Recommended)

Create `/home/your-user/whisper-service/app.py`:

```python
#!/usr/bin/env python3
from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import os
import tempfile
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Load model once at startup (uses GPU automatically on Jetson)
# Options: tiny, base, small, medium, large
MODEL_SIZE = os.environ.get('WHISPER_MODEL', 'small')
logger.info(f"Loading Whisper model: {MODEL_SIZE}")

# faster-whisper with GPU acceleration
model = WhisperModel(
    MODEL_SIZE,
    device="cuda",  # Use GPU
    compute_type="float16"  # Optimized for GPU
)

logger.info(f"✓ Whisper model loaded: {MODEL_SIZE}")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model': MODEL_SIZE,
        'device': 'cuda (Jetson AGX Orin)'
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        # Get audio file from request
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']
        language = request.form.get('language', 'en')

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name

        logger.info(f"Transcribing: {audio_file.filename}, language: {language}")

        # Transcribe with faster-whisper
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True  # Voice Activity Detection
        )

        # Combine all segments
        transcript = " ".join([segment.text for segment in segments])

        # Cleanup
        os.unlink(tmp_path)

        logger.info(f"✓ Transcription completed: {len(transcript)} characters")

        return jsonify({
            'transcript': transcript,
            'language': info.language,
            'duration': info.duration
        })

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run on all interfaces so it's accessible from network
    app.run(host='0.0.0.0', port=5000, threaded=True)
```

### Make it executable:

```bash
chmod +x app.py
```

### Test locally:

```bash
python3 app.py
```

You should see:
```
✓ Whisper model loaded: small
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
```

## Step 3: Create System Service (Auto-Start)

Create `/etc/systemd/system/whisper.service`:

```ini
[Unit]
Description=Whisper Transcription Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/home/your-user/whisper-service
Environment="WHISPER_MODEL=small"
ExecStart=/usr/bin/python3 /home/your-user/whisper-service/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable whisper
sudo systemctl start whisper
sudo systemctl status whisper
```

## Step 4: Network Configuration

You have **3 options** for connecting your cloud server to your home Jetson:

### Option 1: Port Forwarding (Simplest)

**Setup:**
1. Go to your router admin panel (usually 192.168.1.1)
2. Find "Port Forwarding" or "Virtual Server"
3. Add rule:
   - **External Port**: 5000
   - **Internal IP**: Your Jetson IP (e.g., 192.168.1.100)
   - **Internal Port**: 5000
   - **Protocol**: TCP

**Security**: Add basic authentication to your Flask app or use firewall rules.

**Your cloud server connects to**: `http://your-home-ip:5000`

**Get your home IP**: https://whatismyipaddress.com/

### Option 2: Cloudflare Tunnel (Recommended - Secure & Free)

**No port forwarding needed!**

```bash
# On Jetson, install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
chmod +x cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create jetson-whisper

# Configure tunnel
nano ~/.cloudflared/config.yml
```

Add:
```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/your-user/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: whisper.yourdomain.com
    service: http://localhost:5000
  - service: http_status:404
```

```bash
# Run tunnel
cloudflared tunnel run jetson-whisper
```

**Your cloud server connects to**: `https://whisper.yourdomain.com`

**Benefits**:
- ✅ Free
- ✅ HTTPS automatically
- ✅ No port forwarding
- ✅ Secure by default
- ✅ Works behind any firewall

### Option 3: Tailscale VPN (Easiest - Recommended)

**Install on both Jetson AND cloud server:**

```bash
# On Jetson
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# On your cloud server (DigitalOcean)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

**Now they're on same VPN!**

Your cloud server connects to Jetson's Tailscale IP: `http://100.x.x.x:5000`

**Benefits**:
- ✅ Super easy setup (5 minutes)
- ✅ Secure encrypted VPN
- ✅ No port forwarding
- ✅ Works anywhere
- ✅ Free for personal use

## Step 5: Integrate with Your Microservice

Update your Node.js microservice:

```typescript
// app/services/jetson-whisper.service.ts
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

export class JetsonWhisperService {
  private jetsonUrl: string;

  constructor() {
    // Use Tailscale IP, Cloudflare domain, or public IP
    this.jetsonUrl = process.env.JETSON_WHISPER_URL || 'http://100.x.x.x:5000';
    console.log(`Jetson Whisper service: ${this.jetsonUrl}`);
  }

  async transcribe(audioFilePath: string, language: string): Promise<string> {
    try {
      console.log(`Transcribing with Jetson Whisper: ${audioFilePath}`);

      const formData = new FormData();
      formData.append('audio', fs.createReadStream(audioFilePath));
      formData.append('language', language.split('-')[0]); // 'en-US' -> 'en'

      const response = await axios.post(`${this.jetsonUrl}/transcribe`, formData, {
        headers: formData.getHeaders(),
        timeout: 600000, // 10 minutes
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const transcript = response.data.transcript;
      console.log(`✓ Jetson transcription completed: ${transcript.length} characters`);

      return transcript;
    } catch (error: any) {
      console.error('Jetson Whisper error:', error.message);
      throw new Error(`Jetson Whisper transcription failed: ${error.message}`);
    }
  }
}
```

Update `.env`:
```env
TRANSCRIPTION_PROVIDER=jetson
JETSON_WHISPER_URL=http://100.x.x.x:5000
```

## Step 6: Test Everything

### Test from Jetson locally:

```bash
curl http://localhost:5000/health
```

### Test from your laptop:

```bash
# Using Tailscale IP
curl http://100.x.x.x:5000/health

# Test transcription
curl -X POST http://100.x.x.x:5000/transcribe \
  -F "audio=@test-audio.wav" \
  -F "language=en"
```

### Test from cloud server:

```bash
# SSH into DigitalOcean server
ssh root@your-server-ip

# Test connection
curl http://100.x.x.x:5000/health
```

## Performance Tuning

### Use Best Model for Your Needs:

```bash
# Edit environment in systemd service
sudo nano /etc/systemd/system/whisper.service

# Change WHISPER_MODEL
Environment="WHISPER_MODEL=small"   # Fast, good quality
# or
Environment="WHISPER_MODEL=medium"  # Slower, better quality

sudo systemctl restart whisper
```

### Monitor Performance:

```bash
# Watch GPU usage
sudo tegrastats

# Watch process
htop
```

### Optimize for Speed:

```python
# In app.py, use these settings for faster processing:
model = WhisperModel(
    MODEL_SIZE,
    device="cuda",
    compute_type="int8_float16",  # Even faster!
    num_workers=4
)
```

## Cost Analysis

### Your Setup:
- **Jetson AGX Orin**: Already owned ($$$$ saved!)
- **Power**: ~30W × 24h × 30 days = 21.6 kWh/month = **~$2-3/month**
- **Internet**: Existing connection = **$0 extra**
- **Tailscale VPN**: Free tier = **$0**

**Total monthly cost: ~$2-3** (just electricity!)

### vs APIs (100 videos @ 40 min each):
- **Your Jetson**: $2-3/month
- **OpenAI API**: $96/month
- **Google Cloud**: $380/month

**You save**: $94-378/month! 💰

## Security Recommendations

1. **Use Tailscale** (recommended) - Already encrypted
2. **Or add basic auth**:
```python
from flask_httpauth import HTTPBasicAuth
auth = HTTPBasicAuth()

@auth.verify_password
def verify(username, password):
    return username == 'whisper' and password == 'your-secret-pass'

@app.route('/transcribe', methods=['POST'])
@auth.login_required
def transcribe():
    # ... your code
```

3. **Firewall**:
```bash
sudo ufw enable
sudo ufw allow 5000/tcp  # Only if using port forwarding
sudo ufw allow ssh
```

## Monitoring & Maintenance

### Check logs:
```bash
sudo journalctl -u whisper -f
```

### Restart service:
```bash
sudo systemctl restart whisper
```

### Update Whisper:
```bash
pip3 install --upgrade openai-whisper faster-whisper
sudo systemctl restart whisper
```

## Troubleshooting

### GPU not being used:

```bash
# Check CUDA
python3 -c "import torch; print(torch.cuda.is_available())"

# If False, reinstall PyTorch for Jetson
```

### Service won't start:

```bash
sudo journalctl -u whisper -n 50
# Check for Python errors
```

### Can't connect from cloud:

```bash
# Test from Jetson
curl http://localhost:5000/health

# Check firewall
sudo ufw status

# Check Tailscale
tailscale status
```

## Next Steps

1. ✅ Set up Jetson with Whisper service
2. ✅ Install Tailscale on both Jetson and cloud server
3. ✅ Test transcription locally on Jetson
4. ✅ Test connection from cloud server
5. ✅ Integrate with your microservice
6. ✅ Test end-to-end with a YouTube video
7. ✅ Set up monitoring

**This setup will save you hundreds of dollars per month!** 🎉

Need help with any specific step? Just ask!
