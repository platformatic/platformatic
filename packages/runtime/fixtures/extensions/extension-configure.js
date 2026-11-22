import { isMainThread } from 'node:worker_threads'
import { join } from 'node:path'

export const events = []

export async function configure (config, { root, options }) {
  await Promise.resolve()
  events.push({ isMainThread, root, options, ids: config.applications.map(app => app.id) })

  if (options.invalid) {
    config.logger = false
    return
  }

  if (options.fail) {
    const error = new Error('Configuration failed')
    error.code = 'TEST_CONFIGURATION_FAILED'
    throw error
  }

  config.env = { ...config.env, CONFIGURE_ORDER: `${config.env?.CONFIGURE_ORDER ?? ''}${options.value}` }

  // The application reads PORT during evaluation, proving this hook runs first.
  config.applications[0].envfile = join(root, '../configure.env')
}

export function setup () {}
