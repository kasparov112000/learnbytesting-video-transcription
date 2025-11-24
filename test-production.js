#!/usr/bin/env node

/**
 * Test Script for Production YouTube Transcription
 *
 * This script tests the video-transcription service in production
 * to verify that YouTube bot detection fixes are working.
 */

const https = require('https');

// Configuration
const PRODUCTION_URL = 'orchestrator.learnbytesting.ai';
let TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Short video for testing
const LANGUAGE = 'en-US';
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLLS = 60; // 5 minutes max

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PRODUCTION_URL,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function startTranscription(videoUrl, language) {
  log('\n🎬 Starting transcription...', 'blue');
  log(`   Video: ${videoUrl}`, 'cyan');
  log(`   Language: ${language}`, 'cyan');

  const response = await makeRequest('POST', '/video-transcription/transcribe', {
    youtubeUrl: videoUrl,
    language: language
  });

  if (response.statusCode !== 202 && response.statusCode !== 200) {
    throw new Error(`Failed to start transcription: ${response.statusCode} - ${JSON.stringify(response.data)}`);
  }

  log(`✓ Transcription started!`, 'green');
  log(`   ID: ${response.data.transcriptionId}`, 'cyan');
  return response.data.transcriptionId;
}

async function getStatus(transcriptionId) {
  const response = await makeRequest('GET', `/video-transcription/status/${transcriptionId}`);

  if (response.statusCode !== 200) {
    throw new Error(`Failed to get status: ${response.statusCode} - ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

async function pollStatus(transcriptionId) {
  let polls = 0;

  log('\n📊 Polling for status...', 'blue');

  while (polls < MAX_POLLS) {
    polls++;

    const status = await getStatus(transcriptionId);

    // Display status
    const statusColor =
      status.status === 'completed' ? 'green' :
      status.status === 'failed' ? 'red' :
      status.status === 'processing' ? 'yellow' :
      'cyan';

    process.stdout.write(`\r   Status: ${colors[statusColor]}${status.status}${colors.reset} | Progress: ${status.progress || 0}%   `);

    if (status.status === 'completed') {
      log('\n✓ Transcription completed!', 'green');
      return { success: true, status };
    }

    if (status.status === 'failed') {
      log('\n✗ Transcription failed!', 'red');
      log(`   Error: ${status.error || 'Unknown error'}`, 'red');

      // Check for bot detection error
      if (status.error && status.error.includes('Sign in to confirm')) {
        log('\n⚠️  YouTube Bot Detection Error Detected!', 'yellow');
        log('   The fix did not work. The service needs YouTube cookies.', 'yellow');
      }

      return { success: false, status };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  log('\n⏱️  Timeout: Polling took too long', 'yellow');
  return { success: false, status: { status: 'timeout' } };
}

async function getTranscript(transcriptionId) {
  log('\n📄 Fetching transcript...', 'blue');

  const response = await makeRequest('GET', `/video-transcription/transcript/${transcriptionId}`);

  if (response.statusCode !== 200) {
    throw new Error(`Failed to get transcript: ${response.statusCode}`);
  }

  log('✓ Transcript retrieved!', 'green');
  return response.data;
}

async function main() {
  const startTime = Date.now();

  log('\n' + '='.repeat(60), 'bright');
  log('  Production YouTube Transcription Test', 'bright');
  log('='.repeat(60), 'bright');
  log(`  Target: https://${PRODUCTION_URL}`, 'cyan');
  log('='.repeat(60) + '\n', 'bright');

  try {
    // Step 1: Start transcription
    const transcriptionId = await startTranscription(TEST_VIDEO_URL, LANGUAGE);

    // Step 2: Poll for completion
    const result = await pollStatus(transcriptionId);

    // Step 3: Get transcript if successful
    if (result.success) {
      const transcript = await getTranscript(transcriptionId);

      log('\n📝 Transcript Preview:', 'blue');
      const preview = transcript.transcript.substring(0, 200);
      log(`   ${preview}...`, 'cyan');
      log(`\n   Video Title: ${transcript.videoTitle}`, 'cyan');
      log(`   Duration: ${transcript.videoDuration}s`, 'cyan');
      log(`   Word Count: ${transcript.wordCount}`, 'cyan');
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    log('\n' + '='.repeat(60), 'bright');
    if (result.success) {
      log('  ✓ TEST PASSED', 'green');
      log('  YouTube bot detection fix is working!', 'green');
    } else {
      log('  ✗ TEST FAILED', 'red');
      log(`  Error: ${result.status.error || 'Unknown error'}`, 'red');
    }
    log(`  Duration: ${duration}s`, 'cyan');
    log('='.repeat(60) + '\n', 'bright');

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    log('\n' + '='.repeat(60), 'bright');
    log('  ✗ TEST ERROR', 'red');
    log('='.repeat(60), 'bright');
    log(`  ${error.message}`, 'red');
    if (error.stack) {
      log(`\n${error.stack}`, 'red');
    }
    log('='.repeat(60) + '\n', 'bright');
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.length > 2) {
  const customUrl = process.argv[2];
  log(`Using custom video URL: ${customUrl}`, 'yellow');
  TEST_VIDEO_URL = customUrl;
}

// Run the test
main();
