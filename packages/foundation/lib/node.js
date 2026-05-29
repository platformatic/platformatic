import { platform } from 'node:os'
import { lt, satisfies } from 'semver'

const currentPlatform = platform()

export function checkNodeVersionForApplications () {
  const currentVersion = process.version
  const minimumVersion = '22.19.0'

  if (lt(currentVersion, minimumVersion)) {
    throw new Error(
      `Your current Node.js version is ${currentVersion}, while the minimum supported version is v${minimumVersion}. Please upgrade Node.js and try again.`
    )
  }
}

/*
  Node.js >= 26 bundles undici >= 8, whose built-in `fetch()` reads the global
  dispatcher from `Symbol.for('undici.globalDispatcher.2')`. Our bundled undici
  (v7) `setGlobalDispatcher()` only writes `Symbol.for('undici.globalDispatcher.1')`,
  so the application's global `fetch()` bypasses the runtime mesh interceptor and
  internal `*.plt.local` calls fail with ENOTFOUND.

  Mirror the dispatcher onto every known global dispatcher symbol so the built-in
  `fetch()` and the userland undici observe the same dispatcher, regardless of
  which undici version Node bundles. This can be dropped once undici aligns the
  symbols across versions: https://github.com/nodejs/undici/pull/5319
*/
export function mirrorGlobalDispatcherForBuiltinFetch (dispatcher) {
  for (const version of [1, 2]) {
    const symbol = Symbol.for(`undici.globalDispatcher.${version}`)
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, symbol)

    if (!descriptor) {
      Object.defineProperty(globalThis, symbol, {
        value: dispatcher,
        writable: true,
        enumerable: false,
        configurable: false
      })
    } else if (descriptor.writable) {
      // The symbol is created as non-configurable but writable, so a plain
      // assignment is the only legal way to update an already-defined slot.
      globalThis[symbol] = dispatcher
    }
  }
}

export const features = {
  node: {
    reusePort: satisfies(process.version, '^22.12.0 || ^23.1.0 || >=24.0.0') && !['win32', 'darwin'].includes(currentPlatform),
    worker: {
      getHeapStatistics: satisfies(process.version, '^22.16.0 || >=24.0.0')
    },
    permission: {
      // The Permission Model gates network access (dns.lookup, listen, connect,
      // fetch) behind --allow-net starting from Node.js 25. On older versions the
      // flag does not exist and must not be passed.
      network: process.allowedNodeEnvironmentFlags.has('--allow-net')
    }
  }
}
