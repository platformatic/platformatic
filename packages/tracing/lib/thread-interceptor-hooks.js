import { createThreadInterceptorHooks } from '@platformatic/instrumentation-thread-interceptor'

// The runtime owns the thread interceptor, so the hooks are passed explicitly rather than by patching the module.
// The receiving side is traced by @platformatic/instrumentation-light-my-request.
export function createTelemetryThreadInterceptorHooks () {
  return createThreadInterceptorHooks()
}
