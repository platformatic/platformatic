import { existsSync } from 'node:fs'
import { glob, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve as resolvePath } from 'node:path'
import * as errors from './errors.js'

export async function resolveStandaloneEntrypoint (root) {
  const serverEntrypoints = await Array.fromAsync(
    glob(['server.js', '.next/standalone/**/server.js', '**/server.js'], {
      cwd: root,
      exclude: ['node_modules', '**/node_modules/**']
    })
  )

  for (const entrypoint of serverEntrypoints) {
    if (entrypoint !== 'server.js' && !existsSync(resolvePath(root, dirname(entrypoint), '.next'))) {
      continue
    }

    const candidate = resolvePath(root, entrypoint)
    const contents = await readFile(candidate, 'utf-8')

    if (contents.includes('process.env.__NEXT_PRIVATE_STANDALONE_CONFIG =')) {
      return candidate
    }
  }

  throw new errors.StandaloneServerNotFound()
}

export async function parseStandaloneNextConfig (serverEntrypoint) {
  try {
    const serverJsContent = await readFile(serverEntrypoint, 'utf-8')
    const nextConfigMatch = serverJsContent.match(/(?:const|let)\s*nextConfig\s*=\s*(\{.+)/)
    return JSON.parse(nextConfigMatch[1])
  } catch (e) {
    throw new errors.CannotParseStandaloneServer({ cause: e })
  }
}

export function requireStandaloneStartServer (serverEntrypoint) {
  let serverModule

  try {
    serverModule = createRequire(serverEntrypoint)('next/dist/server/lib/start-server.js')
  } catch (e) {
    serverModule = createRequire(import.meta.url)('next/dist/server/lib/start-server.js')
  }

  return serverModule.default ?? serverModule
}
