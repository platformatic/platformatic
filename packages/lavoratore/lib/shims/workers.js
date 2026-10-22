// Minimal implementation of the "cloudflare:workers" module, provided to Workers running inside a Watt thread.

const pending = new Set()

export const env = {}

export function waitUntil (promise) {
  const tracked = Promise.resolve(promise)
    .catch(() => {})
    .finally(() => pending.delete(tracked))

  pending.add(tracked)
}

export function drainWaitUntil () {
  return Promise.allSettled(Array.from(pending))
}

export function createExecutionContext () {
  return {
    props: {},
    waitUntil,
    passThroughOnException () {}
  }
}

export class RpcTarget {}

export class WorkerEntrypoint extends RpcTarget {
  constructor (ctx, env) {
    super()
    this.ctx = ctx
    this.env = env
  }
}

export class DurableObject extends RpcTarget {
  constructor (ctx, env) {
    super()
    this.ctx = ctx
    this.env = env
  }
}

export class WorkflowEntrypoint extends RpcTarget {
  constructor (ctx, env) {
    super()
    this.ctx = ctx
    this.env = env
  }
}
