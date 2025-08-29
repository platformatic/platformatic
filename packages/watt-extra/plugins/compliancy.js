import { getCompliancyMetadata } from '../compliance/index.js'
import {
  CompliancyMetadataError,
  CompliancyStatusError
} from '../lib/errors.js'

async function compliancy (app, _opts) {
  async function checkCompliancy () {
    if (app.env.PLT_DISABLE_COMPLIANCE_CHECK === true) return

    // Skip compliance check if ICC is not configured
    if (!app.env.PLT_ICC_URL) {
      app.log.info('PLT_ICC_URL not set, skipping compliance check')
      return
    }

    const runtime = app.wattpro.runtime
    const applicationId = app.instanceConfig?.applicationId
    const appDir = app.env.PLT_APP_DIR

    const { default: build, setDefaultHeaders } = await import('../clients/compliance/compliance.mjs')
    const complianceUrl = app.instanceConfig?.iccServices?.compliance?.url

    if (!complianceUrl) {
      app.log.warn('No compliance URL found in ICC services')
      return
    }
    const compliancyClient = build(complianceUrl)

    // There is a better way? We need to set the default headers for the client
    // every time, because the token might be expired
    // And we cannot set the global dispatcher because it's shared with the runtime main thread.
    setDefaultHeaders(await app.getAuthorizationHeader())
    const compliancyMetadata = await getCompliancyMetadata({
      projectDir: appDir,
      runtime
    })

    {
      const res = await compliancyClient.postMetadata({
        applicationId,
        data: compliancyMetadata
      })

      if (res.statusCode !== 200 && res.statusCode !== 201) {
        app.log.error(res, 'Failed to send compliancy metadata')
        throw new CompliancyMetadataError()
      }

      app.log.info('Compliancy metadata sent')
    }

    {
      const res = await compliancyClient.postCompliance({ applicationId })
      if (res.statusCode !== 200) {
        app.log.error(res, 'Failed to get compliance status')
        throw new CompliancyStatusError()
      }

      const { compliant, report } = JSON.parse(res.body)

      if (!compliant) {
        app.log.error(report, 'Compliancy check failed')
      }
    }
  }
  app.checkCompliancy = checkCompliancy
}

export default compliancy
