#!/usr/bin/env bash
#
# Test Video Transcription Endpoint
# This script tests the /transcription/transcribe endpoint with a YouTube URL
#

# Configuration
API_URL="http://localhost:3016"
YOUTUBE_URL="https://www.youtube.com/watch?v=rBG1Lty78lI"
LANGUAGE="en-US"

echo "=========================================="
echo "Video Transcription API Test"
echo "=========================================="
echo ""
echo "API URL: $API_URL"
echo "YouTube URL: $YOUTUBE_URL"
echo "Language: $LANGUAGE"
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
echo "Response: $HEALTH_RESPONSE"
echo ""

# Test 2: Start Transcription
echo "2. Starting transcription..."
TRANSCRIBE_RESPONSE=$(curl -s -X POST "$API_URL/transcription/transcribe" \
  -H "Content-Type: application/json" \
  -d "{
    \"youtubeUrl\": \"$YOUTUBE_URL\",
    \"language\": \"$LANGUAGE\"
  }")

echo "Response:"
echo "$TRANSCRIBE_RESPONSE" | jq '.' 2>/dev/null || echo "$TRANSCRIBE_RESPONSE"
echo ""

# Extract transcription ID from response
TRANSCRIPTION_ID=$(echo "$TRANSCRIBE_RESPONSE" | jq -r '.transcriptionId' 2>/dev/null)

if [ -z "$TRANSCRIPTION_ID" ] || [ "$TRANSCRIPTION_ID" = "null" ]; then
  echo "❌ Failed to start transcription"
  echo "Response did not contain a transcription ID"
  exit 1
fi

echo "✓ Transcription started successfully!"
echo "Transcription ID: $TRANSCRIPTION_ID"
echo ""

# Test 3: Check Status
echo "3. Checking transcription status..."
echo "Polling every 5 seconds..."
echo ""

MAX_ATTEMPTS=60  # Poll for up to 5 minutes
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  STATUS_RESPONSE=$(curl -s "$API_URL/transcription/status/$TRANSCRIPTION_ID")

  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status' 2>/dev/null)
  PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress' 2>/dev/null)

  echo "[Attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS] Status: $STATUS, Progress: $PROGRESS%"

  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo "✓ Transcription completed successfully!"
    echo ""
    echo "=========================================="
    echo "RESULTS:"
    echo "=========================================="
    echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
    echo ""

    # Get the full transcript
    echo "4. Fetching full transcript..."
    TRANSCRIPT_RESPONSE=$(curl -s "$API_URL/transcription/transcript/$TRANSCRIPTION_ID")
    echo "$TRANSCRIPT_RESPONSE" | jq '.transcript' 2>/dev/null || echo "$TRANSCRIPT_RESPONSE"

    exit 0
  fi

  if [ "$STATUS" = "failed" ]; then
    echo ""
    echo "❌ Transcription failed"
    echo "Error: $(echo "$STATUS_RESPONSE" | jq -r '.error' 2>/dev/null)"
    exit 1
  fi

  ATTEMPT=$((ATTEMPT + 1))
  sleep 5
done

echo ""
echo "⚠️ Transcription did not complete within timeout period"
echo "Last status: $STATUS"
echo "You can check the status manually using:"
echo "curl $API_URL/transcription/status/$TRANSCRIPTION_ID"
