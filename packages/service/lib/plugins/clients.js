import client from '@platformatic/client'
import { kMetadata } from '@platformatic/utils'
import fp from 'fastify-plugin'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
async function setupClientsPlugin (app, opts) {
  for (const { path, url, serviceId, name, schema, type, fullRequest, fullResponse, validateResponse } of opts) {
    if (path) {
      const require = createRequire(resolve(app.platformatic.config[kMetadata].root, 'noop.js'))
      app.register(await require(path), { url, serviceId })
    } else {
      app.register(client, { url, serviceId, name, path: schema, type, fullRequest, fullResponse, validateResponse })
    }
  }
}

export const setupClients = fp(setupClientsPlugin)
