import {
  MetadataRuntimeError,
  MetadataError,
  MetadataStateError,
  MetadataAppIdError,
  MetadataRuntimeNotStartedError
} from '../lib/errors.js'

async function metadata (app, _opts) {
  async function sendMetadata () {
    // Skip metadata processing if ICC is not configured
    if (!app.env.PLT_ICC_URL) {
      app.log.info('PLT_ICC_URL not set, skipping metadata processing')
      return
    }

    const applicationId = app.instanceConfig?.applicationId
    const runtime = app.wattpro.runtime
    if (!applicationId) {
      app.log.warn('Cannot process metadata: no applicationId available')
      throw new MetadataAppIdError()
    }

    if (!runtime) {
      app.log.warn('Cannot process metadata: runtime not started')
      throw new MetadataRuntimeNotStartedError()
    }

    try {
      const { default: build, setDefaultHeaders } = await import('../clients/control-plane/control-plane.mjs')
      const controlPlaneClient = build(app.env.PLT_CONTROL_PLANE_URL)

      try {
        const [runtimeConfig, runtimeMetadata] = await Promise.all([
          runtime.getRuntimeConfig(),
          runtime.getRuntimeMetadata()
        ])

        const applications = await Promise.all(
          runtimeConfig.applications.map((application) =>
            runtime.getApplicationDetails(application.id)
          )
        )

        try {
          // There is a better way? We need to set the default headers for the client
          // every time, because the token might be expired
          // And we cannot set the global dispatcher because it's shared with the runtime main thread.
          setDefaultHeaders(await app.getAuthorizationHeader())
          await controlPlaneClient.saveApplicationInstanceState({
            id: app.instanceId,
            applications,
            metadata: runtimeMetadata
          }, {
            headers: await app.getAuthorizationHeader()
          })
        } catch (error) {
          app.log.error('Failed to save application state to Control Plane', error)
          throw new MetadataStateError()
        }

        app.log.info('Runtime metadata processed')
      } catch (error) {
        if (error.code === 'PLT_METADATA_STATE_ERROR') {
          throw error
        }
        app.log.error(error, 'Failed in getting and processing runtime metadata')
        throw new MetadataRuntimeError()
      }
    } catch (error) {
      if (error.code === 'PLT_METADATA_APP_ID_ERROR' ||
          error.code === 'PLT_METADATA_RUNTIME_NOT_STARTED_ERROR' ||
          error.code === 'PLT_METADATA_RUNTIME_ERROR' ||
          error.code === 'PLT_METADATA_STATE_ERROR') {
        throw error
      }
      app.log.error(error, 'Failure in metadata processing')
      throw new MetadataError()
    }
  }
  app.sendMetadata = sendMetadata
}

export default metadata
