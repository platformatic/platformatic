import { register, registerHooks } from 'node:module'

function isFunction (value) {
  return typeof value === 'function'
}

function getSyncHook (loaderModule, syncName, asyncName) {
  if (isFunction(loaderModule[syncName])) {
    return loaderModule[syncName]
  }

  const hook = loaderModule[asyncName]
  if (isFunction(hook) && hook.constructor.name !== 'AsyncFunction') {
    return hook
  }
}

export async function registerLoader (loader, data, options = {}) {
  if (!loader) {
    return
  }

  // OpenTelemetry currently installs import-in-the-middle with module.register().
  // Combining that asynchronous loader with a synchronous registerHooks() loader
  // can break ESM namespace wrapping, so keep the legacy path when telemetry is on.
  if (options.registerHooks && isFunction(registerHooks) && !(data?.telemetryConfig && data.telemetryConfig.enabled !== false)) {
    const loaderModule = await import(loader)
    const hooks = {}

    if (isFunction(loaderModule.initializeSync)) {
      loaderModule.initializeSync(data)
    }

    const resolve = getSyncHook(loaderModule, 'resolveSync', 'resolve')
    if (resolve) {
      hooks.resolve = resolve
    }

    const load = getSyncHook(loaderModule, 'loadSync', 'load')
    if (load) {
      hooks.load = load
    }

    if (hooks.resolve || hooks.load) {
      registerHooks(hooks)
      return
    }
  }

  register(loader, { data })
}
