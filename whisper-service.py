#!/usr/bin/env python3
"""
Self-hosted Whisper Transcription Service
Simple Flask API for transcribing audio files using OpenAI's Whisper model

Usage:
    python whisper-service.py

Requirements:
    pip install openai-whisper flask flask-cors
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
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

import whisper

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Model configuration
MODEL_SIZE = os.environ.get('WHISPER_MODEL', 'base')
logger.info(f"Loading Whisper model: {MODEL_SIZE}")
logger.info("This may take a minute on first run (downloading model)...")

try:
    # Load model once at startup
    # Available models: tiny, base, small, medium, large
    # - tiny: 75MB, fastest, good for simple audio
    # - base: 142MB, fast, recommended for testing (CURRENT DEFAULT)
    # - small: 466MB, slower, very good quality
    # - medium: 1.5GB, slow, excellent quality
    # - large: 2.9GB, slowest, best quality
    model = whisper.load_model(MODEL_SIZE)
    logger.info(f"✓ Whisper model loaded successfully: {MODEL_SIZE}")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    logger.error("Make sure you have installed whisper: pip install openai-whisper")
    raise

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'whisper-transcription',
        'model': MODEL_SIZE,
        'device': 'cpu',  # Change to 'cuda' if using GPU
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
        # Check if audio file is present
        if 'audio' not in request.files:
            logger.error("No audio file in request")
            return jsonify({'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']
        language = request.form.get('language', 'en')

        if audio_file.filename == '':
            logger.error("Empty filename")
            return jsonify({'error': 'Empty filename'}), 400

        logger.info(f"Received transcription request:")
        logger.info(f"  - Filename: {audio_file.filename}")
        logger.info(f"  - Language: {language}")

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name

        logger.info(f"  - Saved to: {tmp_path}")
        logger.info(f"  - File size: {os.path.getsize(tmp_path) / (1024 * 1024):.2f} MB")
        logger.info("Starting transcription...")

        # Transcribe using Whisper
        result = model.transcribe(
            tmp_path,
            language=language,
            verbose=False,
            fp16=False  # Set to True if using GPU
        )

        # Cleanup temp file
        try:
            os.unlink(tmp_path)
        except Exception as e:
            logger.warning(f"Failed to delete temp file: {e}")

        transcript = result['text']
        detected_language = result.get('language', language)
        duration = result.get('duration', 0)

        elapsed_time = time.time() - start_time

        logger.info(f"✓ Transcription completed in {elapsed_time:.2f}s")
        logger.info(f"  - Transcript length: {len(transcript)} characters")
        logger.info(f"  - Audio duration: {duration:.2f}s")
        logger.info(f"  - Detected language: {detected_language}")

        return jsonify({
            'transcript': transcript,
            'language': detected_language,
            'duration': duration,
            'processing_time': elapsed_time
        })

    except Exception as e:
        logger.error(f"Transcription error: {str(e)}", exc_info=True)

        # Cleanup temp file if it exists
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
        'service': 'Self-hosted Whisper Transcription Service',
        'version': '1.0.0',
        'model': MODEL_SIZE,
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
                    'language': 'Language code like "en", "es" (optional, default: en)'
                }
            }
        }
    })

if __name__ == '__main__':
    logger.info("="*60)
    logger.info("Self-hosted Whisper Transcription Service")
    logger.info("="*60)
    logger.info(f"Model: {MODEL_SIZE}")
    logger.info("Starting server on http://0.0.0.0:5000")
    logger.info("Press Ctrl+C to stop")
    logger.info("="*60)

    # Run on all interfaces so it's accessible from network
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,  # Set to True for development
        threaded=True  # Allow multiple simultaneous requests
    )
