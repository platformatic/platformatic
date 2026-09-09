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
const kMirroredGlobalDispatcher = Symbol.for('platformatic.undici.mirroredGlobalDispatcher')
const kMirroredLegacyGlobalDispatcher = Symbol.for('platformatic.undici.mirroredLegacyGlobalDispatcher')

export function mirrorGlobalDispatcherForBuiltinFetch (dispatcher, legacyDispatcher = dispatcher) {
  for (const version of [1, 2]) {
    const symbol = Symbol.for(`undici.globalDispatcher.${version}`)
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, symbol)
    const value = version === 1 ? legacyDispatcher : dispatcher

    if (!descriptor) {
      Object.defineProperty(globalThis, symbol, {
        value,
        writable: true,
        enumerable: false,
        configurable: false
      })
    } else if (descriptor.writable) {
      // The symbol is created as non-configurable but writable, so a plain
      // assignment is the only legal way to update an already-defined slot.
      globalThis[symbol] = value
    }
  }

  globalThis[kMirroredGlobalDispatcher] = dispatcher
  globalThis[kMirroredLegacyGlobalDispatcher] = legacyDispatcher
}

export function getGlobalDispatcherFromKnownUndiciSymbols () {
  const mirroredDispatcher = globalThis[kMirroredGlobalDispatcher]
  const mirroredLegacyDispatcher = globalThis[kMirroredLegacyGlobalDispatcher]
  const legacyDispatcher = globalThis[Symbol.for('undici.globalDispatcher.1')]
  const dispatcher = globalThis[Symbol.for('undici.globalDispatcher.2')]

  if (mirroredDispatcher) {
    if (dispatcher && dispatcher !== mirroredDispatcher) {
      return dispatcher
    }

    if (legacyDispatcher && legacyDispatcher !== (mirroredLegacyDispatcher ?? mirroredDispatcher)) {
      return legacyDispatcher
    }
  }

  return dispatcher ?? legacyDispatcher
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

/*
  Node.js only writes the module compile cache to disk when the process, or the worker thread that
  populated it, terminates. Processes are often killed abruptly (SIGKILL, OOM killer, container
  eviction), which discards the cache accumulated while booting and makes the next start pay the
  full compilation cost again.

  Flushing explicitly once the boot is complete, when most modules have been loaded, makes the cache
  durable. Repeated flushes are cheap as Node.js skips the entries which have already been persisted.
*/
export function scheduleCompileCacheFlush (logger) {
  // Defer the flush so that it never delays the caller.
  setImmediate(async () => {
    try {
      const { flushCompileCache } = await import('node:module')

      // flushCompileCache is available on Node.js 22.10.0+ and it is a no-op when the compile cache
      // has not been enabled.
      if (typeof flushCompileCache !== 'function') {
        return
      }

      const start = process.hrtime.bigint()
      flushCompileCache()
      const duration = Number(process.hrtime.bigint() - start) / 1e6

      logger?.debug({ duration }, 'Module compile cache flushed')
    } catch (err) {
      logger?.warn({ err }, 'Error flushing module compile cache')
    }
  })
}
