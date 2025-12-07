#!/usr/bin/env python3
"""
Self-hosted Whisper Transcription Service
Simple Flask API for transcribing audio files using the optimized faster-whisper library.

Usage:
    python whisper-service.py

Requirements:
    pip install faster-whisper flask flask-cors torch
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import tempfile
import os
import logging
import time

# Add FFmpeg to PATH for Windows
if os.name == 'nt':  # Windows
    ffmpeg_path = r'C:\Users\Renato\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0-essentials_build\bin'
    if os.path.exists(ffmpeg_path) and ffmpeg_path not in os.environ['PATH']:
        os.environ['PATH'] = ffmpeg_path + os.pathsep + os.environ['PATH']
        logger_pre = logging.getLogger(__name__)
        logger_pre.info(f"Added FFmpeg to PATH: {ffmpeg_path}")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# --- Model Configuration ---
# Set the model size via environment variable
# Recommended models for GPU (e.g., GTX 1060 6GB): 'large-v3' with int8 quantization
# Other options: 'tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'
MODEL_SIZE = os.environ.get('WHISPER_MODEL', 'large-v3')
DEVICE = "cuda"
COMPUTE_TYPE = "int8"

logger.info(f"Loading faster-whisper model: {MODEL_SIZE}")
logger.info(f"  - Device: {DEVICE}")
logger.info(f"  - Compute Type: {COMPUTE_TYPE}")
logger.info("This may take a minute on first run (downloading and converting model)...")

try:
    # Load model once at startup
    model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    logger.info(f"✓ faster-whisper model loaded successfully: {MODEL_SIZE}")
except Exception as e:
    logger.error(f"Failed to load faster-whisper model: {e}")
    logger.error("Make sure you have installed torch and CUDA correctly for your GPU.")
    logger.error("Installation command: pip install faster-whisper torch")
    raise

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'faster-whisper-transcription',
        'model': MODEL_SIZE,
        'device': DEVICE,
        'compute_type': COMPUTE_TYPE,
        'timestamp': time.time()
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio file

    Expected form data:
    - audio: Audio file (wav, mp3, m4a, flac, etc.)
    - language: Language code (optional, default: en)

    Returns:
    - transcript: Transcribed text
    - language: Detected/specified language
    - duration: Audio duration in seconds
    """
    start_time = time.time()

    try:
        if 'audio' not in request.files:
            logger.error("No audio file in request")
            return jsonify({'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']
        language = request.form.get('language') # Let faster-whisper detect if None

        if audio_file.filename == '':
            logger.error("Empty filename")
            return jsonify({'error': 'Empty filename'}), 400

        logger.info(f"Received transcription request:")
        logger.info(f"  - Filename: {audio_file.filename}")
        logger.info(f"  - Language: {language or 'auto-detect'}")

        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name

        logger.info(f"  - Saved to: {tmp_path}")
        logger.info(f"  - File size: {os.path.getsize(tmp_path) / (1024 * 1024):.2f} MB")
        logger.info("Starting transcription...")

        # Transcribe using faster-whisper
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5
        )

        # The result is an iterator, so we need to join the segments
        transcript_parts = [segment.text for segment in segments]
        transcript = "".join(transcript_parts).strip()

        detected_language = info.language
        duration = info.duration

        try:
            os.unlink(tmp_path)
        except Exception as e:
            logger.warning(f"Failed to delete temp file: {e}")

        elapsed_time = time.time() - start_time

        logger.info(f"✓ Transcription completed in {elapsed_time:.2f}s")
        logger.info(f"  - Transcript length: {len(transcript)} characters")
        logger.info(f"  - Audio duration: {duration:.2f}s")
        logger.info(f"  - Detected language: {detected_language} (Probability: {info.language_probability:.2f})")

        return jsonify({
            'transcript': transcript,
            'language': detected_language,
            'duration': duration,
            'processing_time': elapsed_time
        })

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}", exc_info=True)

        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass

        return jsonify({
            'error': str(e),
            'error_type': type(e).__name__
        }), 500

@app.route('/', methods=['GET'])
def index():
    """Root endpoint with service info"""
    return jsonify({
        'service': 'Self-hosted faster-whisper Transcription Service',
        'version': '2.0.0',
        'model': MODEL_SIZE,
        'device': DEVICE,
        'compute_type': COMPUTE_TYPE,
        'endpoints': {
            'health': '/health - GET - Health check',
            'transcribe': '/transcribe - POST - Transcribe audio file'
        },
        'usage': {
            'transcribe': {
                'method': 'POST',
                'content_type': 'multipart/form-data',
                'fields': {
                    'audio': 'Audio file (required)',
                    'language': 'Language code like "en", "es" (optional, auto-detects if omitted)'
                }
            }
        }
    })

if __name__ == '__main__':
    logger.info("="*60)
    logger.info("Self-hosted faster-whisper Transcription Service")
    logger.info("="*60)
    logger.info(f"Model: {MODEL_SIZE}")
    logger.info(f"Device: {DEVICE}")
    logger.info(f"Compute Type: {COMPUTE_TYPE}")
    logger.info("Starting server on http://0.0.0.0:5000")
    logger.info("Press Ctrl+C to stop")
    logger.info("="*60)

    # Run on all interfaces so it's accessible from network
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        threaded=True
    )
