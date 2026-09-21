'use strict'

// Simulates a transpiled ES module: the real default export is reachable as the
// "default" property of module.exports, which Node exposes as the ESM default.
Object.defineProperty(exports, '__esModule', { value: true })

exports.default = async function setup ({ options }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'faux-esm-default', options })

  return {
    start () {
      events.push({ event: 'start', extension: 'faux-esm-default' })
    },
    stop () {
      events.push({ event: 'stop', extension: 'faux-esm-default' })
    },
    close () {
      events.push({ event: 'close', extension: 'faux-esm-default' })
    }
  }
}
