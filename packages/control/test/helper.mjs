import { execa } from 'execa'
import { on, once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import split from 'split2'
import { Agent, setGlobalDispatcher } from 'undici'

setGlobalDispatcher(
  new Agent({
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
)

const startPath = createRequire(import.meta.url).resolve('@platformatic/runtime/test/cli/start.mjs')

export async function getPlatformaticVersion () {
  const packageJsonPath = new URL('../package.json', import.meta.url)
  const packageJson = await readFile(packageJsonPath, 'utf8')
  return JSON.parse(packageJson).version
}

export async function startRuntime (configPath, env = {}, additionalArgs = []) {
  const runtime = execa(process.execPath, [startPath, configPath, ...additionalArgs], { env })

  const output = runtime.stdout.pipe(
    split(function (line) {
      try {
        const obj = JSON.parse(line)
        return obj
      } catch (err) {
        console.log(line)
      }
    })
  )

  const errorTimeout = setTimeout(() => {
    throw new Error("Couldn't start server")
  }, 30000)

  for await (const messages of on(output, 'data')) {
    for (const message of messages) {
      if (message.msg) {
        const url = message.url ?? message.msg.match(/server listening at (.+)/i)?.[1]

        if (url !== undefined) {
          clearTimeout(errorTimeout)
          await sleep(1000)
          return { runtime, url, output }
        }
      }
    }
  }
}

export async function kill (runtime, signal = 'SIGKILL') {
  if (typeof runtime.exitCode === 'number') {
    return
  }
  safeKill(runtime, signal)
  await once(runtime, 'exit')
}

export async function safeKill (child, signal = 'SIGINT') {
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
