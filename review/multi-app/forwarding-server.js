import { mkdir, writeFile, symlink, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { create } from '../../packages/runtime/index.js'
import { fileURLToPath } from 'node:url'
const workspace = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const root = '/tmp/watt-forwarding'
const policy = process.env.MULTI_POLICY
// All variants use the same benchmark entry-module overlay; no loader threads.
const execArgv = []
await mkdir(root, { recursive: true })
for (const id of ['app', 'gateway']) {
  const type = id === 'app' ? 'service' : 'gateway'
  await mkdir(`${root}/${id}/node_modules/@platformatic`, { recursive: true })
  await symlink(`${workspace}/packages/${type}`, `${root}/${id}/node_modules/@platformatic/${type}`)
  await writeFile(`${root}/${id}/package.json`, '{"type":"module"}')
  if (id === 'app') await writeFile(`${root}/${id}/routes.js`, `import {workerData} from 'node:worker_threads'; export default async function(app){app.get('/cheap', (req,reply)=>reply.header('x-bench-worker', String(workerData.worker.index)).send('ok'))}`)
  await writeFile(`${root}/${id}/platformatic.json`, JSON.stringify({
    $schema: `https://schemas.platformatic.dev/@platformatic/${type}/3.71.0.json`, watch: false,
    ...(id === 'app' ? { service: { openapi: false }, plugins: { paths: ['./routes.js'] } } : {
      gateway: { applications: [{ id: 'app', proxy: { prefix: '/', rewritePrefix: '/' } }] }
    })
  }))
}
await writeFile(root + '/platformatic.json', JSON.stringify({
  $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/3.71.0.json', entrypoint: 'gateway',
  applications: [{ id: 'app', path: './app', config: 'platformatic.json', workers: 4, execArgv,
    ...(policy === 'least' ? { requestRouting: { algorithm: 'least-outstanding', maxOutstanding: 128 } } : {}) },
  { id: 'gateway', path: './gateway', config: 'platformatic.json', workers: 1, execArgv }],
  server: { hostname: '0.0.0.0', port: 3000, ...(process.env.MULTI_PROTOCOL === 'h2' ? { http2: true } : {}) },
  logger: { level: 'silent' }, watch: false, managementApi: false
}))
const runtime = await create(root + '/platformatic.json', undefined, { isProduction: true, setupSignals: false })
await runtime.start()
const control = createServer(async (req, res) => {
  if (req.url === '/stop') { res.end('stopping'); await runtime.close(); control.close(); return }
  const [cpu, memory] = await Promise.all(['cpu.stat', 'memory.current'].map(name => readFile('/sys/fs/cgroup/' + name, 'utf8')))
  res.end(JSON.stringify({ at: Date.now(), ready: true, workers: Object.values(await runtime.getWorkers()), cpu, memory: Number(memory) }))
})
control.listen(3999, '0.0.0.0')
