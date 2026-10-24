import { createServer } from 'node:http'
export function create () {
  return createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({
      id: 'api',
      shared: process.env.SHARED,
      fromEntry: process.env.FROM_ENTRY ?? null,
      fromRootBlock: process.env.FROM_ROOT_BLOCK,
      fromRootFile: process.env.FROM_ROOT_FILE,
      selfUrl: process.env.PLT_API_URL ?? null,
      siblingApi: process.env.PLT_API_URL,
      siblingFrontend: process.env.PLT_FRONTEND_URL
    }))
  })
}
