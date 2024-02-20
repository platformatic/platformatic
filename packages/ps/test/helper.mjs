import { on } from 'node:events'
import { execa } from 'execa'
import split from 'split2'

const runtimeCliPath = import.meta.resolve('@platformatic/runtime/runtime.mjs').replace('file://', '')

export async function startRuntime (configPath) {
  const runtime = execa(process.execPath, [runtimeCliPath, 'start', '-c', configPath])
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
