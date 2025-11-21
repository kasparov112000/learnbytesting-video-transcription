FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    flask==3.0.0 \
    openai-whisper==20231117 \
    gunicorn==21.2.0

# Copy application
COPY whisper-service.py .

# Download model during build (optional - can also download on first run)
# Uncomment to bake model into image (increases image size but faster startup)
# RUN python -c "import whisper; whisper.load_model('base')"

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/health')"

# Run with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "600", "whisper-service:app"]
