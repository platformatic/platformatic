import { cp, mkdir, writeFile, symlink, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { BroadcastChannel } from 'node:worker_threads'
import { performance } from 'node:perf_hooks'
import { pbkdf2Sync } from 'node:crypto'
import { create } from '../../packages/runtime/index.js'
import { fileURLToPath } from 'node:url'
const workspace = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '')
const scaler = process.env.MULTI_SCALER === '1'
const tls = process.env.MULTI_PROTOCOL?.endsWith('tls')
const events = []
const ids = process.env.MULTI_APPS ? process.env.MULTI_APPS.split(',') : ['catalog', 'rendering', 'search', 'personalization']
const root = '/tmp/watt-multi-app'
const health = new Map(), timeline = []
const channel = new BroadcastChannel('watt.multi-app.health')
channel.onmessage = ({ data }) => { health.set(`${data.app}:${data.index}`, data); timeline.push(data) }
await mkdir(root, { recursive: true })
await symlink(`${workspace}/node_modules`, root + '/node_modules')
for (const id of [...ids, 'gateway']) {
  const type = id === 'gateway' ? 'gateway' : 'service'
  await mkdir(`${root}/${id}/node_modules/@platformatic`, { recursive: true })
  await writeFile(`${root}/${id}/package.json`, '{"type":"module"}')
  await symlink(`${workspace}/packages/${type}`, `${root}/${id}/node_modules/@platformatic/${type}`)
  if (type === 'service') await symlink(`${workspace}/packages/runtime`, `${root}/${id}/node_modules/@platformatic/runtime`)
  if (type === 'service') await cp(new URL('./routes.js', import.meta.url), `${root}/${id}/routes.js`)
  else await cp(new URL('./gateway-health.js', import.meta.url), `${root}/${id}/gateway-health.js`)
  await writeFile(`${root}/${id}/platformatic.json`, JSON.stringify({
    $schema: `https://schemas.platformatic.dev/@platformatic/${type}/3.71.0.json`, watch: false,
    ...(type === 'service' ? { service: { openapi: false }, plugins: { paths: [{ path: './routes.js' }] } } : {
      plugins: { paths: ['./gateway-health.js'] },
      gateway: { applications: ids.map(id => ({ id, proxy: { prefix: `/${id}`, rewritePrefix: '/' } })) }
    })
  }))
}
const applications = ids.map(id => ({ id, path: `./${id}`, config: 'platformatic.json', workers: scaler ? { static: 2, dynamic: true, minimum: 1, maximum: 3 } : 2,
  ...(process.env.MULTI_POLICY === 'rr' ? {} : { requestRouting: { algorithm: 'least-outstanding', maxOutstanding: 64 } }) }))
applications.push({ id: 'gateway', path: './gateway', config: 'platformatic.json', workers: Number(process.env.MULTI_FRONTENDS || 1) })
await writeFile(root + '/platformatic.json', JSON.stringify({
  $schema: 'https://schemas.platformatic.dev/@platformatic/runtime/3.71.0.json', entrypoint: 'gateway', applications,
  server: { hostname: '0.0.0.0', port: 3000, ...(process.env.MULTI_PROTOCOL?.startsWith('h2') ? { http2: true } : {}),
    ...(tls ? { https: { key: { path: `${workspace}/review/multi-app/tls/key.pem` }, cert: { path: `${workspace}/review/multi-app/tls/cert.pem` }, allowHTTP1: true } } : {}) },
  health: { enabled: false, maxHeapTotal: 268435456, maxYoungGeneration: 16777216 },
  ...(scaler ? { workers: { total: 9, maximum: 3, maxMemory: 1610612736, cooldown: 0, gracePeriod: 0 } } : {}),
  logger: { level: 'silent' }, managementApi: false, watch: false
}))
const runtime = await create(root + '/platformatic.json', undefined, { isProduction: true, setupSignals: false })
for (const name of ['application:worker:started', 'application:worker:stopped', 'application:worker:exited']) runtime.on(name, data => events.push({ name, at: Date.now(), ...data }))
await runtime.start()
if (scaler) runtime.logger.level = 'debug'
const control = createServer(async (req, res) => {
  if (req.url === '/stop') { res.end('stopping'); await runtime.close(); control.close(); channel.close(); return }
  if (req.url === '/calibrate') {
    const t = performance.now(); for (let i = 0; i < 10; i++) pbkdf2Sync('multi-app', 'fixed-seed', 10000, 16, 'sha256')
    res.end(JSON.stringify({ msPer10000: (performance.now() - t) / 10 })); return
  }
  const [cpu, memory, memoryEvents] = await Promise.all(['cpu.stat', 'memory.current', 'memory.events'].map(name => readFile('/sys/fs/cgroup/' + name, 'utf8')))
  const current = Object.values(await runtime.getWorkers()).filter(w => w.status === 'started' && ids.includes(w.application))
  const active = [...health.values()].filter(w => current.some(c => c.thread === w.threadId))
  res.end(JSON.stringify({ at: Date.now(), ready: ids.every(id => active.some(w => w.app === id)), ids, workers: active, runtimeWorkers: Object.values(await runtime.getWorkers()), events,
    timeline: req.url === '/timeline' ? timeline : undefined, cpu, memory: Number(memory), memoryEvents, rss: process.memoryUsage().rss }))
})
control.listen(3999, '0.0.0.0', () => console.log('ready'))
