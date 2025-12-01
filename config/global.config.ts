const ENV_NAME = process.env.ENV_NAME || 'LOCAL';
const msport = 3016;
const { version: appVersion, name: appName } = require('../../package.json');

const serviceConfigs = {
  port: msport,
  envName: ENV_NAME,
  useAuth: process.env.USE_AUTH || true,
  appName: appName,
  appVersion: process.env.CHARTS_RELEASE_VERSION || appVersion,

  // MongoDB Configuration
  mongoDbUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/mdr-video-transcriptions',

  // Transcription Service Provider: 'google', 'openai', 'self-hosted', or 'mock'
  transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER || 'self-hosted',

  // Mock Transcription (for testing without API charges)
  useMockTranscription: process.env.USE_MOCK_TRANSCRIPTION === 'true',

  // Self-hosted Whisper Configuration (recommended - 95% cost savings!)
  whisperServiceUrl: process.env.WHISPER_SERVICE_URL || 'http://localhost:5000',

  // Google Cloud Speech-to-Text Configuration
  googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  gcsBucketName: process.env.GCS_BUCKET_NAME || 'lbt-video-transcription-temp',

  // OpenAI Configuration
  openaiApiKey: process.env.OPENAI_API_KEY,

  // File Storage Configuration
  tempAudioDir: process.env.TEMP_AUDIO_DIR || './temp/audio',
  maxVideoLengthSeconds: parseInt(process.env.MAX_VIDEO_LENGTH_SECONDS || '7200'), // Default 2 hours

  // Processing Configuration
  cleanupTempFiles: process.env.CLEANUP_TEMP_FILES !== 'false', // Default true
  audioFormat: process.env.AUDIO_FORMAT || 'wav', // wav or flac
  audioChannels: parseInt(process.env.AUDIO_CHANNELS || '1'), // Mono by default
  audioSampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '16000'), // 16kHz for speech

  // Language Configuration
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en-US',

  // YouTube Configuration (to bypass bot detection)
  youtubeCookiesBrowser: process.env.YOUTUBE_COOKIES_BROWSER, // e.g., 'chrome', 'firefox', 'edge'
  youtubeCookiesFile: process.env.YOUTUBE_COOKIES_FILE,
  youtubeUserAgent: process.env.YOUTUBE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  youtubeApiKey: process.env.YOUTUBE_API_KEY, // YouTube Data API v3 key for caption fetching

  // Python YouTube Downloader Service (dedicated yt-dlp microservice)
  pythonDownloaderUrl: process.env.PYTHON_DOWNLOADER_URL || 'http://localhost:3017',

  // Questions Service (for auto-creating questions from transcripts)
  questionsServiceUrl: process.env.QUESTIONS_SERVICE_URL || (process.env.ENV_NAME === 'LOCAL' ? 'http://localhost:3011' : 'http://questions:3011'),
};

// App Dynamics Configuration
const debug = process.env.APPD_DEBUG || true;
const controllerHostName = process.env.APPDYNAMICS_CONTROLLER_HOST_NAME || '<hostname>';
const controllerPort = process.env.APPDYNAMICS_CONTROLLER_PORT || 443;
const controllerSslEnabled = process.env.APPDYNAMICS_CONTROLLER_SSL_ENABLED || true;
const accountName = process.env.APPDYNAMICS_ACCOUNT_NAME || '<accountname>';
const accountAccessKey = process.env.APPDYNAMICS_ACCOUNT_ACCESS_KEY || '<accesskey>';
const applicationName = process.env.APPDYNAMICS_APPLICATION_NAME || '<appname>';
const tierName = process.env.APPDYNAMICS_TIER_NAME || 'video-transcription';
const nodeName = process.env.APPDYNAMICS_NODE_NAME || 'video-transcription';

const appDynamicsConfigs = {
  environmentName: ENV_NAME,
  port: msport,
  enableAppdynamics: process.env.ENABLE_APPDYNAMICS || false,
  appdynamicsProfile: {
    debug: debug,
    controllerHostName: controllerHostName,
    controllerPort: controllerPort,
    controllerSslEnabled: controllerSslEnabled,
    accountName: accountName,
    accountAccessKey: accountAccessKey,
    applicationName: applicationName,
    tierName: tierName,
    nodeName: nodeName,
    reuseNode: true,
    reuseNodePrefix: 'video-transcription',
    libagent: true
  }
};

export { serviceConfigs, appDynamicsConfigs };
