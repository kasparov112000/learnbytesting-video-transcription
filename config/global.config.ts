const ENV_NAME = process.env.ENV_NAME || 'LOCAL';
const msport = (process.env.ENV_NAME || 'LOCAL') !== 'LOCAL' ? 3000 : 3016;
const { version: appVersion, name: appName } = require('../package.json');

const serviceConfigs = {
  port: msport,
  envName: ENV_NAME,
  useAuth: process.env.USE_AUTH || true,
  appName: appName,
  appVersion: process.env.CHARTS_RELEASE_VERSION || appVersion,

  // MongoDB Configuration
  mongoDbUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/mdr-video-transcriptions',

  // Transcription Service Provider: 'google' or 'openai'
  transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER || 'google',

  // Google Cloud Speech-to-Text Configuration
  googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,

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
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en-US'
};

// App Dynamics Configuration
const debug = process.env.APPD_DEBUG || true;
const controllerHostName = process.env.APPDYNAMICS_CONTROLLER_HOST_NAME || '<hostname>';
const controllerPort = process.env.APPDYNAMICS_CONTROLLER_PORT || 443;
const controllerSslEnabled = process.env.APPDYNAMICS_CONTROLLER_SSL_ENABLED || true;
const accountName = process.env.APPDYNAMICS_ACCOUNT_NAME || '<accountname>';
const accountAccessKey = process.env.APPDYNAMICS_ACCOUNT_ACCESS_KEY || '<accesskey>';
const applicationName = process.env.APPDYNAMICS_APPLICATION_NAME || '<appname>';
const tierName = 'video-transcription' || process.env.APPDYNAMICS_TIER_NAME;
const nodeName = 'video-transcription' || process.env.APPDYNAMICS_NODE_NAME;

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
