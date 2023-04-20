import { join } from 'desm'
import fastify from 'fastify'

const cliPath = join(import.meta.url, '..', 'cli.js')

async function startDeployService (t, options = {}) {
  const deployService = fastify({ keepAliveTimeout: 1 })

  deployService.post('/bundles', async (request, reply) => {
    const createBundleCallback = options.createBundleCallback || (() => {})
    await createBundleCallback(request, reply)

    return {
      id: 'default-bundle-id',
      token: 'default-upload-token',
      isBundleUploaded: false
    }
  })

  deployService.post('/deployments', async (request, reply) => {
    const createDeploymentCallback = options.createDeploymentCallback || (() => {})
    await createDeploymentCallback(request, reply)
  })

  deployService.addContentTypeParser(
    'application/x-tar',
    { bodyLimit: 1024 * 1024 * 1024 },
    (request, payload, done) => done()
  )

  deployService.put('/upload', async (request, reply) => {
    const uploadCallback = options.uploadCallback || (() => {})
    await uploadCallback(request, reply)
  })

  t.teardown(async () => {
    await deployService.close()
  })

  return deployService.listen({ port: 3042 })
}

async function startMachine (t, callback = () => {}) {
  const machine = fastify({ keepAliveTimeout: 1 })

  machine.get('/', async (request, reply) => {
    await callback(request, reply)
  })

  t.teardown(async () => {
    await machine.close()
  })

  return machine.listen({ port: 0 })
}

export {
  cliPath,
  startDeployService,
  startMachine
}
