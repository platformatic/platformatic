import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { getLogsFromFile, prepareRuntime, setFixturesDir } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should run the application with custom logger options on json', async t => {
  const { root, runtime } = await prepareRuntime(t, 'logger-custom-options-json', false, null)

  await runtime.init()
  await runtime.buildApplication('runtime')
  const url = await runtime.start()

  await request(url + '/', { method: 'GET' })
  await runtime.close()

  const logs = await getLogsFromFile(root)

  assert.ok(
    logs.find(log => {
      return (
        log.stdout &&
        log.stdout.level === 'DEBUG' &&
        log.stdout.name === 'RUNTIME' &&
        log.stdout.msg === 'call route /' &&
        log.stdout.secret === '***HIDDEN***' &&
        log.stdout.time.length === 24
      ) // isoTime
    })
  )
})

test('should run the application with custom logger options on global this', async t => {
  const { root, runtime } = await prepareRuntime(t, 'logger-custom-options-global-this', false, null)

  await runtime.init()
  await runtime.buildApplication('runtime')
  const url = await runtime.start()

  await request(url + '/', { method: 'GET' })
  await runtime.close()

  const logs = await getLogsFromFile(root)

  // Check if it contains a log with the right message
  assert.ok(
    logs.find(l => {
      return l.level === 20 && l.msg === 'call route /' && l.name === 'APP1' && l.secret === '***HIDDEN***'
    })
  )
})
