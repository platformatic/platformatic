// Runs inside the spawned `nuxt.mjs dev` child process, before the Nuxt CLI loads.
//
// Nuxt 4's dev CLI probes a random port with a throwaway `net.Server` (via
// listhen/get-port-please) before the real server listens. The generic URL
// capture in `packages/basic/lib/worker/child-process.js` subscribes to the
// FIRST `net.server.listen` trace and therefore reports the probe's URL, which
// races the real server's startup and intermittently fails with ECONNREFUSED.
//
// This script opts the Nuxt child into Nuxt's own dev IPC so the CLI reports
// its real `ready` address (after the build, when the serving server is up),
// and forwards that URL to the parent via the child-manager `url` event — the
// same channel `startWithCommand` already waits on.
import { getITC } from '@platformatic/globals'

process.env.__NUXT__FORK = '1'

process.send = function (message) {
  if (!message || message.type !== 'nuxt:internal:dev:ready') {
    return
  }

  const address = message.address
  if (typeof address !== 'string' || address.length === 0) {
    return
  }

  getITC({ throwOnMissing: false })?.notify('url', address)
}
