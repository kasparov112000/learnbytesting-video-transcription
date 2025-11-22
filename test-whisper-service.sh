#!/usr/bin/env bash
#
# Test Self-Hosted Whisper Service
# This script tests the Whisper service connection and transcription
#

WHISPER_URL="http://localhost:5000"

echo "=========================================="
echo "Self-Hosted Whisper Service Test"
echo "=========================================="
echo ""
echo "Whisper Service URL: $WHISPER_URL"
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$WHISPER_URL/health" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Cannot connect to Whisper service at $WHISPER_URL"
  echo ""
  echo "Make sure the Whisper service is running:"
  echo "  python whisper-service.py"
  echo ""
  echo "Or install dependencies first:"
  echo "  pip install openai-whisper flask flask-cors"
  echo ""
  exit 1
fi

echo "Response:"
echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
echo ""

# Check if service is healthy
STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null)
if [ "$STATUS" != "ok" ]; then
  echo "❌ Whisper service is not healthy"
  exit 1
fi

echo "✓ Whisper service is running and healthy!"
MODEL=$(echo "$HEALTH_RESPONSE" | jq -r '.model' 2>/dev/null)
echo "  Model: $MODEL"
echo ""

# Test 2: Check if we have a test audio file
echo "2. Looking for test audio file..."

# Common test audio file locations
TEST_AUDIO_PATHS=(
  "temp/audio/test.wav"
  "temp/audio/test.mp3"
  "test-audio.wav"
  "test-audio.mp3"
)

TEST_AUDIO=""
for path in "${TEST_AUDIO_PATHS[@]}"; do
  if [ -f "$path" ]; then
    TEST_AUDIO="$path"
    echo "✓ Found test audio: $TEST_AUDIO"
    break
  fi
done

if [ -z "$TEST_AUDIO" ]; then
  echo "⚠ No test audio file found"
  echo ""
  echo "To test transcription, you need an audio file."
  echo "You can:"
  echo "  1. Download a test file from YouTube using the main service"
  echo "  2. Place a .wav or .mp3 file in temp/audio/test.wav"
  echo "  3. Run the full test-transcription.sh script instead"
  echo ""
  echo "✓ Whisper service is ready - just waiting for audio files!"
  exit 0
fi

# Test 3: Test Transcription
echo ""
echo "3. Testing transcription..."
echo "This may take 1-2 minutes depending on audio length and model size..."
echo ""

TRANSCRIBE_RESPONSE=$(curl -s -X POST "$WHISPER_URL/transcribe" \
  -F "audio=@$TEST_AUDIO" \
  -F "language=en" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Transcription request failed"
  echo "Error: $TRANSCRIBE_RESPONSE"
  exit 1
fi

echo "Response:"
echo "$TRANSCRIBE_RESPONSE" | jq '.' 2>/dev/null || echo "$TRANSCRIBE_RESPONSE"
echo ""

# Check if transcription was successful
TRANSCRIPT=$(echo "$TRANSCRIBE_RESPONSE" | jq -r '.transcript' 2>/dev/null)
if [ -z "$TRANSCRIPT" ] || [ "$TRANSCRIPT" = "null" ]; then
  echo "❌ No transcript in response"
  echo "Response: $TRANSCRIBE_RESPONSE"
  exit 1
fi

echo "✓ Transcription successful!"
echo ""
echo "=========================================="
echo "TRANSCRIPT PREVIEW:"
echo "=========================================="
echo "$TRANSCRIPT" | head -c 500
if [ ${#TRANSCRIPT} -gt 500 ]; then
  echo "..."
  echo ""
  echo "(showing first 500 characters)"
fi
echo ""
echo ""

PROCESSING_TIME=$(echo "$TRANSCRIBE_RESPONSE" | jq -r '.processing_time' 2>/dev/null)
DURATION=$(echo "$TRANSCRIBE_RESPONSE" | jq -r '.duration' 2>/dev/null)

if [ "$PROCESSING_TIME" != "null" ]; then
  echo "Processing time: ${PROCESSING_TIME}s"
fi
if [ "$DURATION" != "null" ]; then
  echo "Audio duration: ${DURATION}s"
fi

echo ""
echo "=========================================="
echo "✅ ALL TESTS PASSED!"
echo "=========================================="
echo ""
echo "Your self-hosted Whisper service is working perfectly!"
echo "You can now use it with your video transcription microservice."
echo ""
