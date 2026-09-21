'use strict'

// Simulates a transpiled ES module exporting a named setup function. The exports
// object is built dynamically so that the named export is not statically
// detectable and setup is only reachable through the ESM default export.
function createExports () {
  return {
    __esModule: true,
    async setup ({ options }) {
      const events = (globalThis.__pltExtensionEvents ??= [])
      events.push({ event: 'setup', extension: 'faux-esm-setup', options })

      return {
        start () {
          events.push({ event: 'start', extension: 'faux-esm-setup' })
        },
        stop () {
          events.push({ event: 'stop', extension: 'faux-esm-setup' })
        },
        close () {
          events.push({ event: 'close', extension: 'faux-esm-setup' })
        }
      }
    }
  }
}

module.exports = createExports()
