import { createServer } from 'node:http'
import { platform, tmpdir } from 'node:os'
import { resolve } from 'node:path'

let socketPath = null

/* c8 ignore next 7 */
if (platform() === 'win32') {
  socketPath = `\\\\.\\pipe\\plt-${process.pid}`
} else {
  // As stated in https://nodejs.org/dist/latest-v20.x/docs/api/net.html#identifying-paths-for-ipc-connections,
  // Node will take care of deleting the file for us
  socketPath = resolve(tmpdir(), `plt-unix-socket-${process.pid}.socket`)
}

function handler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  res.end(JSON.stringify({ ok: true }))
  process.nextTick(() => {
    server.close()
  })
}

const server = createServer(handler).listen({ path: socketPath })
globalThis[Symbol.for('plt.children.itc')].notify('path', socketPath)
