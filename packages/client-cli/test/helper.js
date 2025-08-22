import { createDirectory, safeRemove } from '@platformatic/foundation'
import os from 'node:os'
import { join } from 'path'
import { Agent, setGlobalDispatcher } from 'undici'

setGlobalDispatcher(
  new Agent({
    keepAliveMaxTimeout: 1,
    keepAliveTimeout: 1
  })
)

export { request } from 'undici'

let counter = 0

export async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const tmp = join(import.meta.dirname, 'tmp')
  try {
    await createDirectory(tmp)
  } catch {}
  const dir = join(tmp, `platformatic-client-${process.pid}-${Date.now()}-${counter++}`)
  await createDirectory(dir)
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    teardown(async () => {
      await safeRemove(tmp)
    })
  }
  return dir
}

export async function safeKill (child) {
  const execa = (await import('execa')).execa
  child.catch(() => {})
  child.kill('SIGINT')
  if (os.platform() === 'win32') {
    try {
      await execa('wmic', ['process', 'where', `ParentProcessId=${child.pid}`, 'delete'])
      await execa('wmic', ['process', 'where', `ProcessId=${child.pid}`, 'delete'])
    } catch (err) {
      if (err.stderr.indexOf('not found') === 0) {
        console.error(`Failed to kill process ${child.pid}`)
        console.error(err)
      }
    }
  }
}

export const cliPath = join(import.meta.dirname, '..', 'index.js')
