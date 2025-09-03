import pprof from '@datadog/pprof'
import * as runtime from '@platformatic/runtime'
import { request } from 'undici'

const kITC = runtime.symbols.kITC
const timeout = (parseInt(process.env.PLT_FLAMEGRAPHS_INTERVAL_SEC) || 60) * 1000

let latestProfile = null
let isHandlerRegistered = false

function registerHandler () {
  if (!isHandlerRegistered && globalThis[kITC]) {
    isHandlerRegistered = true

    globalThis[kITC].handle('sendFlamegraph', async (options) => {
      if (latestProfile == null) {
        return { success: false, error: 'No flamegraph profile available' }
      }

      const { url, headers, alertId = null } = options

      if (!url) {
        return { success: false, error: 'No URL provided' }
      }
      if (!headers) {
        return { success: false, error: 'No auth headers provided' }
      }

      try {
        const { statusCode, body } = await request(url, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/octet-stream'
          },
          body: latestProfile.encode(),
          query: alertId ? { alertId } : {}
        })

        if (statusCode !== 200) {
          const error = await body.text()
          return {
            success: false,
            statusCode,
            error: `Failed to send flamegraph: ${error}`
          }
        }
      } catch (err) {
        return { success: false, error: err.message }
      }

      return { success: true }
    })
  }
}

setInterval(async () => {
  // Register an itc handler is ITC is set up
  registerHandler()
  latestProfile = await pprof.time.profile({ durationMillis: timeout })
}, timeout).unref()
