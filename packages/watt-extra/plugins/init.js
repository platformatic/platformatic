import WattPro from '../lib/wattpro.js'
import os from 'node:os'

async function initPlugin (app) {
  async function initApplicationInstance (podId, applicationName = null) {
    const { default: build, setDefaultHeaders } = await import('../clients/control-plane/control-plane.mjs')
    const controlPlaneClient = build(app.env.PLT_CONTROL_PLANE_URL)
    // There is a better way? We need to set the default headers for the client
    // every time, because the token might be expired
    // And we cannot set the global dispatcher because it's shared with the runtime main thread.
    setDefaultHeaders(await app.getAuthorizationHeader())
    const request = { podId }
    if (applicationName) {
      request.applicationName = applicationName
    }
    return controlPlaneClient.initApplicationInstance(request)
  }

  async function initApplication () {
    app.log.info('Starting WattPro runtime manager')

    let applicationName = app.env.PLT_APP_NAME
    const applicationDir = app.env.PLT_APP_DIR
    const instanceId = os.hostname()

    app.log.info({ applicationName, applicationDir }, 'Loading wattpro application')

    // Skip ICC initialization if PLT_ICC_URL is not set
    if (!app.env.PLT_ICC_URL) {
      app.log.info('PLT_ICC_URL not set, skipping ICC initialization')
      app.applicationName = applicationName
      app.instanceConfig = null
      app.instanceId = instanceId
      return
    }

    const instanceConfig = await initApplicationInstance(instanceId, applicationName)
    app.log.info({ applicationId: instanceConfig.applicationId }, 'Got application info')

    // Use the application name from the ICC response if not provided
    applicationName = applicationName || instanceConfig.applicationName
    app.log.info({ applicationName }, 'Application name resolved')

    app.applicationName = applicationName
    app.instanceConfig = instanceConfig
    app.instanceId = instanceId
  }
  try {
    await initApplication()
  } catch (err) {
    // We don't re-throw here because we can continue without application info
    // and nothing here should block the app from start
    app.log.error(err, 'Failed to get application information')

    // Set fallback values when ICC connection fails
    if (!app.applicationName) {
      app.applicationName = app.env.PLT_APP_NAME
      app.instanceConfig = null
      app.instanceId = os.hostname()
    }
  }
  const wattpro = new WattPro(app)
  app.wattpro = wattpro
  app.initApplication = initApplication

  const headers = await app.getAuthorizationHeader()
  await app.wattpro.updateSharedContext({ iccAuthHeaders: headers })
}

export default initPlugin
