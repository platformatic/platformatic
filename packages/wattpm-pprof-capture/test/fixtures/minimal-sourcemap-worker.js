import { parentPort } from 'node:worker_threads'
import { time, SourceMapper } from '@datadog/pprof'
import { resolve } from 'node:path'

console.error('[MINIMAL-WORKER] Worker started')
console.error(`[MINIMAL-WORKER] Platform: ${process.platform}, Node: ${process.version}`)

process.on('uncaughtException', (err) => {
  console.error('[MINIMAL-WORKER] UNCAUGHT EXCEPTION!')
  console.error(`[MINIMAL-WORKER] Error: ${err.message}`)
  console.error(`[MINIMAL-WORKER] Stack: ${err.stack}`)
  parentPort.postMessage({ success: false, error: err.message })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[MINIMAL-WORKER] UNHANDLED REJECTION!')
  console.error(`[MINIMAL-WORKER] Reason: ${reason}`)
  parentPort.postMessage({ success: false, error: String(reason) })
  process.exit(1)
})

process.on('exit', (code) => {
  console.error(`[MINIMAL-WORKER] Worker exiting with code: ${code}`)
})

async function test () {
  try {
    console.error('[MINIMAL-WORKER] Creating SourceMapper...')
    const serviceDir = resolve(import.meta.dirname, 'sourcemap-test/service')
    const sourceMapper = await SourceMapper.create([serviceDir], false)
    console.error('[MINIMAL-WORKER] SourceMapper created successfully')

    console.error('[MINIMAL-WORKER] Starting CPU profiler with SourceMapper...')
    time.start({
      intervalMicros: 33333,
      lineNumbers: true,
      sourceMapper
    })
    console.error('[MINIMAL-WORKER] CPU profiler started')

    console.error('[MINIMAL-WORKER] Waiting 2 seconds...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.error('[MINIMAL-WORKER] Wait complete')

    console.error('[MINIMAL-WORKER] Stopping profiler...')
    const profile = time.stop()
    console.error('[MINIMAL-WORKER] Profiler stopped')
    console.error(`[MINIMAL-WORKER] Profile has ${profile.sample?.length || 0} samples`)

    console.error('[MINIMAL-WORKER] Test completed successfully')
    parentPort.postMessage({ success: true })
    process.exit(0)
  } catch (err) {
    console.error('[MINIMAL-WORKER] Test failed with error:', err.message)
    console.error('[MINIMAL-WORKER] Stack:', err.stack)
    parentPort.postMessage({ success: false, error: err.message })
    process.exit(1)
  }
}

test()
