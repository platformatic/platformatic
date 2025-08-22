import envSchema from 'env-schema'

const schema = {
  type: 'object',
  required: [],
  properties: {
    PLT_APP_NAME: { type: 'string' },
    PLT_ICC_URL: { type: 'string' },
    PLT_APP_DIR: { type: 'string' },
    PLT_TEST_TOKEN: { type: 'string' }, // JWT token for authentication when not in K8s
    PLT_APP_HOSTNAME: { type: 'string', default: '' },
    PLT_APP_PORT: { type: 'number' },
    PLT_METRICS_PORT: { type: 'number', default: 9090 },
    PLT_LOG_LEVEL: { type: 'string', default: 'info' },
    PLT_ICC_RETRY_TIME: { type: 'number', default: 5000 },
    PLT_DISABLE_COMPLIANCE_CHECK: { type: 'boolean', default: false },
    PLT_APP_INTERNAL_SUB_DOMAIN: { type: 'string', default: 'plt.local' },
    PLT_DEFAULT_CACHE_TAGS_HEADER: { type: 'string', default: 'x-plt-cache-tags' },
    PLT_CACHE_CONFIG: { type: 'string' },
    PLT_DISABLE_FLAMEGRAPHS: { type: 'boolean', default: false },
    PLT_FLAMEGRAPHS_INTERVAL_SEC: { type: 'number', default: 60 },
    PLT_JWT_EXPIRATION_OFFSET_SEC: { type: 'number', default: 60 },
    PLT_UPDATES_RECONNECT_INTERVAL_SEC: { type: 'number', default: 1 }
  }
}

// Loads the config calling ICC and populates the env variables,
// using default to allow the app to start without ICC
const getDefaultEnv = (iccUrl) => {
  const defaults = {
    PLT_APP_DIR: process.cwd()
  }

  if (iccUrl) {
    defaults.PLT_CONTROL_PLANE_URL = `${iccUrl}/control-plane`
  }

  return defaults
}

async function envPlugin (app) {
  const env = envSchema({
    schema,
    dotenv: true
  })

  const iccURL = env.PLT_ICC_URL
  const defaultEnv = getDefaultEnv(iccURL)

  app.env = {
    ...defaultEnv,
    ...env
  }

  app.log.info('Environment variables set up')
}

export default envPlugin
