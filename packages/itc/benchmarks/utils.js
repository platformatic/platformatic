import { performance } from 'node:perf_hooks'

function report (name, iterations, startedAt, startCpu) {
  const elapsed = performance.now() - startedAt
  const cpu = process.cpuUsage(startCpu)
  const cpuPerOp = (cpu.user + cpu.system) / iterations

  console.log(
    `${name.padEnd(44)} ${Math.round((iterations * 1000) / elapsed)
      .toLocaleString('en-US')
      .padStart(12)} ops/s ${((elapsed * 1000) / iterations).toFixed(2).padStart(9)} µs/op ${cpuPerOp
      .toFixed(2)
      .padStart(9)} µs CPU/op`
  )
}

export function measure (name, iterations, fn) {
  for (let i = 0; i < Math.max(iterations / 10, 1000); i++) {
    fn()
  }

  const startedAt = performance.now()
  const startCpu = process.cpuUsage()

  for (let i = 0; i < iterations; i++) {
    fn()
  }

  report(name, iterations, startedAt, startCpu)
}

export async function measureAsync (name, iterations, concurrency, fn) {
  async function run (count) {
    for (let i = 0; i < count; i++) {
      await fn()
    }
  }

  async function runAll (count) {
    const perWorker = Math.ceil(count / concurrency)
    await Promise.all(Array.from({ length: concurrency }, () => run(perWorker)))
  }

  await runAll(Math.max(iterations / 10, 1000))

  const startedAt = performance.now()
  const startCpu = process.cpuUsage()
  await runAll(iterations)
  report(name, iterations, startedAt, startCpu)
}

// Rows shaped like a typical database reply: strings, dates, a nested object and an array.
export function createRows (count) {
  const rows = []

  for (let i = 0; i < count; i++) {
    const date = new Date(1763650000000 + i)

    rows.push({
      id: `6f1c9a52-2b8d-4c51-9a0e-${String(i).padStart(12, '0')}`,
      bucket_id: 'avatars',
      name: `folder/sub/file-${i}.png`,
      owner: 'a1b2c3d4-0000-0000-0000-000000000000',
      version: 'f5e1c2d3-1111-2222-3333-444444444444',
      created_at: date,
      updated_at: date,
      last_accessed_at: date,
      metadata: {
        eTag: '"d41d8cd98f00b204e9800998ecf8427e"',
        size: 1024,
        mimetype: 'image/png',
        cacheControl: 'max-age=3600',
        lastModified: date.toISOString(),
        contentLength: 1024,
        httpStatusCode: 200
      },
      user_metadata: null,
      path_tokens: ['folder', 'sub', `file-${i}.png`]
    })
  }

  return rows
}
