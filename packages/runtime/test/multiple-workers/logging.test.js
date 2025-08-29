import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createRuntime, readLogs, updateConfigFile, updateFile } from '../helpers.js'
import { prepareRuntime } from './helper.js'

for (const env of ['development', 'production']) {
  test(`logging properly works in ${env} mode when using separate processes`, async t => {
    const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
    const configFile = resolve(root, './platformatic.json')

    await updateConfigFile(configFile, contents => {
      contents.logger.transport = {
        target: 'pino/file',
        options: { destination: resolve(root, 'logs.txt') }
      }
    })

    await updateConfigFile(resolve(root, 'node/platformatic.json'), contents => {
      contents.application = { commands: { production: 'node index.mjs' } }
    })

    await updateFile(resolve(root, 'node/index.mjs'), contents => {
      contents = contents.replace('function create', 'function main').replace('return app', 'app.listen({ port: 0 })')
      return contents + '\nmain()'
    })

    const app = await createRuntime(configFile, null, { isProduction: env === 'production' })

    t.after(async () => {
      await app.close()
    })

    await app.start()
    await app.stop()

    const messages = await readLogs(resolve(root, 'logs.txt'))
    ok(messages.find(m => m.name === 'composer'))

    for (let i = 0; i < 5; i++) {
      ok(messages.find(m => m.name === `node:${i}` && m.msg.startsWith('Server listening')))
    }
  })
}
