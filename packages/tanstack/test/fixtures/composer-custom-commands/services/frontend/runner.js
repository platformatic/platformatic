import { registerCloseCallback } from '@platformatic/globals'
import { createServer } from 'node:http'
import { middleware } from './dist/server/index.mjs'

// Own the server so custom-command cleanup works independently of CLI signal handlers.
const server = createServer(middleware)
registerCloseCallback(server)
server.listen(3000)
