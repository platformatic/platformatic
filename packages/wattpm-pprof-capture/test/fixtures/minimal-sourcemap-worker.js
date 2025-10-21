import { parentPort } from 'node:worker_threads'
import { time, SourceMapper } from '@datadog/pprof'
import { resolve } from 'node:path'

process.on('uncaughtException', (err) => {
  parentPort.postMessage({ success: false, error: err.message })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  parentPort.postMessage({ success: false, error: String(reason) })
  process.exit(1)
})

async function test () {
  try {
    const serviceDir = resolve(import.meta.dirname, 'sourcemap-test/service')
    const sourceMapper = await SourceMapper.create([serviceDir], false)

    time.start({
      intervalMicros: 33333,
      lineNumbers: true,
      sourceMapper
    })

    await new Promise(resolve => setTimeout(resolve, 2000))

    time.stop()

    parentPort.postMessage({ success: true })
    process.exit(0)
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message })
    process.exit(1)
  }
}

test()
