import { readFile } from 'node:fs/promises'
import { on } from 'node:events'
import { createRequire } from 'node:module'
import { execa } from 'execa'
import { Agent, setGlobalDispatcher } from 'undici'
import split from 'split2'

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10
}))

const runtimeCliPath = createRequire(import.meta.url).resolve('@platformatic/runtime/runtime.mjs')

export async function getPlatformaticVersion () {
  const packageJsonPath = new URL('../package.json', import.meta.url)
  const packageJson = await readFile(packageJsonPath, 'utf8')
  return JSON.parse(packageJson).version
}

export async function startRuntime (configPath, env = {}) {
  const runtime = execa(
    process.execPath, [runtimeCliPath, 'start', '-c', configPath],
    { env }
  )
  runtime.stdout.pipe(process.stdout)
  runtime.stderr.pipe(process.stderr)

  const output = runtime.stdout.pipe(split(function (line) {
    try {
      const obj = JSON.parse(line)
      return obj
    } catch (err) {
      console.log(line)
    }
  }))

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 30000)

  for await (const messages of on(output, 'data')) {
    for (const message of messages) {
      if (message.msg) {
        const url = message.url ??
          message.msg.match(/server listening at (.+)/i)?.[1]

        if (url !== undefined) {
          clearTimeout(errorTimeout)
          return { runtime, url, output }
        }
      }
    }
  }
}
