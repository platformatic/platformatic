'use strict'

import { createRequire } from 'node:module'
import { fetch, getGlobalDispatcher } from 'undici'

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
      if (context.fetch === undefined) return

      const originalFetch = context.fetch
      context.fetch = (input, init = {}) => {
        const url = typeof input === 'string' ? input : input?.url
        if (!url?.startsWith('http://') && !url?.startsWith('https://')) {
          return originalFetch(input, init)
        }

        return fetch(input, { ...init, dispatcher: globalDispatcher })
      }
    })
    return context
  }
}

patchVmCreateContext()
