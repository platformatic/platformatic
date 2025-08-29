'use strict'

import { createRequire } from 'node:module'
import { getGlobalDispatcher } from 'undici'

// Next.js runs middlewares in it's own patched vm context. So the global dispatcher in
// the middleware context is different from an application global dispatcher. This
// method sets an application global dispatcher after next.js defines it's own version of
// fetch function.
export function patchVmCreateContext () {
  const _require = createRequire(process.cwd())
  const vm = _require('node:vm')

  const originalCreateContext = vm.createContext
  vm.createContext = (contextObject, opts) => {
    const globalDispatcher = getGlobalDispatcher()
    const context = originalCreateContext(contextObject, opts)
    queueMicrotask(() => {
      if (contextObject.fetch === undefined) return

      const originalFetch = contextObject.fetch
      contextObject.fetch = (input, init = {}) => {
        init.dispatcher = globalDispatcher
        return originalFetch(input, init)
      }
    })
    return context
  }
}

patchVmCreateContext()
