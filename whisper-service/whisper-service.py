#!/usr/bin/env python3
"""
Self-hosted Whisper transcription service for LearnByTesting
Provides REST API for audio transcription using OpenAI Whisper
"""

from flask import Flask, request, jsonify
import whisper
import tempfile
import os
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Load Whisper model
# Options: tiny, base, small, medium, large
# base = good balance of speed and accuracy
MODEL_SIZE = os.environ.get('WHISPER_MODEL', 'base')

logger.info(f"Loading Whisper model: {MODEL_SIZE}")
try:
    model = whisper.load_model(MODEL_SIZE)
    logger.info(f"✓ Whisper model '{MODEL_SIZE}' loaded successfully")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    raise

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model': MODEL_SIZE,
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio file

    Request:
        - audio: Audio file (multipart/form-data)
        - language: Optional language code (e.g., 'en', 'es')

    Response:
        - transcript: Transcribed text
        - language: Detected/specified language
        - duration: Processing time in seconds
    """
    start_time = datetime.utcnow()

    try:
        # Validate request
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']

        if audio_file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400

        # Get optional parameters
        language = request.form.get('language', None)

        logger.info(f"Transcription request: file={audio_file.filename}, language={language}")

        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        try:
            # Get file size for logging
            file_size = os.path.getsize(tmp_path)
            file_size_mb = file_size / (1024 * 1024)
            logger.info(f"Audio file size: {file_size_mb:.2f} MB")

            # Transcribe
            logger.info("Starting transcription...")

            transcribe_options = {}
            if language:
                transcribe_options['language'] = language

            result = model.transcribe(tmp_path, **transcribe_options)

            # Extract results
            transcript_text = result['text'].strip()
            detected_language = result.get('language', language)

            # Calculate duration
            duration = (datetime.utcnow() - start_time).total_seconds()

            logger.info(f"✓ Transcription completed in {duration:.2f}s")
            logger.info(f"  Text length: {len(transcript_text)} characters")
            logger.info(f"  Language: {detected_language}")

            return jsonify({
                'transcript': transcript_text,
                'language': detected_language,
                'duration': duration,
                'model': MODEL_SIZE,
                'segments': len(result.get('segments', []))
            })

        finally:
            # Cleanup temporary file
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")

    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500

@app.route('/', methods=['GET'])
def index():
    """Root endpoint with service info"""
    return jsonify({
        'service': 'Whisper Transcription Service',
        'version': '1.0.0',
        'model': MODEL_SIZE,
        'endpoints': {
            '/health': 'GET - Health check',
            '/transcribe': 'POST - Transcribe audio file'
        }
    })

if __name__ == '__main__':
    # Run with Flask development server (use gunicorn in production)
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting Whisper service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
