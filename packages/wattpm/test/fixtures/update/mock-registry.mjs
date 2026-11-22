import { readFile } from 'node:fs/promises'
const runtimeInfo = JSON.parse(await readFile(new URL('./runtime-info.json', import.meta.url)))
runtimeInfo['dist-tags'].latest = '3.67.0'
runtimeInfo.versions['3.67.0'] = { version: '3.67.0' }

const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url
  if (url === 'https://registry.npmjs.org/@platformatic/runtime') {
    return new Response(JSON.stringify(runtimeInfo), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  return originalFetch(input, init)
}
