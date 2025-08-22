import { request } from 'undici'

async function alerts (app, _opts) {
  const healthCache = [] // It's OK to have this in memory, this is per-pod.
  const podHealthWindow = app.instanceConfig?.config?.scaler?.podHealthWindow || 60 * 1000
  const alertRetentionWindow = app.instanceConfig?.config?.scaler?.alertRetentionWindow || 30 * 1000
  const isFlamegraphsDisabled = app.env.PLT_DISABLE_FLAMEGRAPHS

  let lastAlertTime = 0
  async function setupAlerts () {
    // Skip alerts setup if ICC is not configured
    if (!app.env.PLT_ICC_URL) {
      app.log.info('PLT_ICC_URL not set, skipping alerts setup')
      return
    }

    const scalerUrl = app.instanceConfig?.iccServices?.scaler?.url
    const runtime = app.wattpro.runtime

    if (!scalerUrl) {
      app.log.warn('No scaler URL found in ICC services, health alerts disabled')
      return
    }

    runtime.on('health', async (healthInfo) => {
      if (!healthInfo) {
        app.log.error('No health info received')
        return
      }

      const timestamp = Date.now()
      const healthWithTimestamp = { ...healthInfo, timestamp }
      delete healthWithTimestamp.healthConfig // we don't need to store this

      healthCache.push(healthWithTimestamp)

      const cutoffTime = timestamp - podHealthWindow
      const validIndex = healthCache.findIndex(entry => entry.timestamp >= cutoffTime)
      if (validIndex > 0) {
        healthCache.splice(0, validIndex)
      }

      // healthInfo is an object with the following structure:
      // id: "service-1"
      // service: "service-1"
      // currentHealth: {
      //   "elu": 0.003816403352054066,
      //   "heapUsed": 76798040,
      //   "heapTotal": 99721216
      // }
      // unhealthy: false
      // healthConfig: {
      //   "enabled": true,
      //   "interval": 1000,
      //   "gracePeriod": 1000,
      //   "maxUnhealthyChecks": 10,
      //   "maxELU": 0.99,
      //   "maxHeapUsed": 0.99,
      //   "maxHeapTotal": 4294967296
      // }

      if (healthInfo.unhealthy) {
        const currentTime = Date.now()
        if (currentTime - lastAlertTime < alertRetentionWindow) {
          app.log.debug('Skipping alert, within retention window')
          return
        }

        lastAlertTime = currentTime
        delete healthInfo.healthConfig

        const authHeaders = await app.getAuthorizationHeader()

        const { statusCode, body } = await request(`${scalerUrl}/alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({
            applicationId: app.instanceConfig?.applicationId,
            alert: healthInfo,
            healthHistory: healthCache
          })
        })

        if (statusCode !== 200) {
          const error = await body.text()
          app.log.error({ error }, 'Failed to send alert to scaler')
          return
        }

        const alert = await body.json()
        const serviceId = healthInfo.id
        const podId = app.instanceId

        if (!isFlamegraphsDisabled) {
          await runtime.sendCommandToService(serviceId, 'sendFlamegraph', {
            url: `${scalerUrl}/pods/${podId}/services/${serviceId}/flamegraph`,
            headers: authHeaders,
            alertId: alert.id
          })
            .catch(() => { app.log.error('Failed to send a flamegraph') })
        }
      }
    })
  }
  app.setupAlerts = setupAlerts
}

export default alerts
