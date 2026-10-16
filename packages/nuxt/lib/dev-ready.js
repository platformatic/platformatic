// Runs inside the spawned `nuxt.mjs dev` child process, before the Nuxt CLI loads.
//
// Nuxt 4's dev CLI probes a random port with a throwaway `net.Server` (via
// listhen/get-port-please) before the real server listens. The generic URL
// capture in `packages/basic/lib/worker/child-process.js` subscribes to the
// FIRST `net.server.listen` trace and therefore reports the probe's URL, which
// races the real server's startup and intermittently fails with ECONNREFUSED.
// Moreover, the Nuxt CLI 4 starts the real server before Nuxt has finished
// loading, and until then it answers every request coming from an unknown host
// (like the one used by the runtime) with a 403.
//
// This script opts the Nuxt child into Nuxt's own dev IPC so the CLI reports
// its real `ready` address (after the build, when the serving server is up),
// and forwards that URL to the parent via the child-manager `url` event — the
// same channel `startWithCommand` already waits on.
//
// Custom development commands might not run the Nuxt CLI at all (and then the
// `ready` message will never be sent). In that case, the address of the first
// application server is reported after a grace period.
import { getITC } from '@platformatic/globals'
import { tracingChannel } from 'node:diagnostics_channel'
import { Server as HttpsServer } from 'node:https'
import { Server as NetServer } from 'node:net'

const FALLBACK_TIMEOUT = 15_000

let reported = false
let fallbackTimer

function report (url) {
  if (reported) {
    return
  }

  reported = true
  clearTimeout(fallbackTimer)
  getITC({ throwOnMissing: false })?.notify('url', url)
}

process.env.__NUXT__FORK = '1'

process.send = function (message) {
  if (!message || message.type !== 'nuxt:internal:dev:ready') {
    return
  }

  const address = message.address
  if (typeof address !== 'string' || address.length === 0) {
    return
  }

  report(address)
}

tracingChannel('net.server.listen').subscribe({
  start () {},
  end () {},
  asyncStart () {},
  error () {},
  asyncEnd ({ server }) {
    // Skip port probes and bare HTTP servers (the framework's own probes).
    if (reported || fallbackTimer || server?.constructor === NetServer || server?.listenerCount('request') === 0) {
      return
    }

    fallbackTimer = setTimeout(() => {
      const address = server.address()

      if (!server.listening || !address || typeof address === 'string') {
        fallbackTimer = undefined
        return
      }

      const protocol = server instanceof HttpsServer ? 'https' : 'http'
      const host = address.family === 'IPv6' ? `[${address.address}]` : address.address

      report(`${protocol}://${host}:${address.port}`)
    }, FALLBACK_TIMEOUT)

    fallbackTimer.unref()
  }
})
