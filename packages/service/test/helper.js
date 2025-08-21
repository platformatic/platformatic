import { Agent, setGlobalDispatcher } from 'undici'
import { createTemporaryDirectory } from '../../basic/test/helper.js'
import { create } from '../index.js'

const agent = new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
})

setGlobalDispatcher(agent)

export function buildConfig (options) {
  const base = {
    server: {}
  }

  return Object.assign(base, options)
}

export async function createFromConfig (t, options, applicationFactory, creationOptions = {}) {
  const directory = await createTemporaryDirectory(t)

  const service = await create(directory, options, {
    applicationFactory,
    isStandalone: true,
    isEntrypoint: true,
    isProduction: creationOptions.production
  })

  if (!creationOptions.skipInit) {
    await service.init()
  }

  if (!creationOptions.skipCleanup) {
    t.after(() => service.stop())
  }

  return service
}
