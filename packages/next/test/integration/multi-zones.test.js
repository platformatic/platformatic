import { ok, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import {
  buildRuntime,
  prepareRuntime,
  setFixturesDir,
  setHMRTriggerFile,
  startRuntime,
  verifyHMR
} from '../../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, '../fixtures'))

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.type ?? message.action) {
    case 'sync':
      resolveConnection()
      break
    case 'serverComponentChanges':
      resolveReload()
  }
}

async function get (url, path) {
  const response = await request(url + path)
  const body = await response.body.text()

  strictEqual(response.statusCode, 200, `${path} returned ${response.statusCode}: ${body}`)
  return { body, headers: response.headers }
}

async function verifyZone (url, { path, name, assetPrefix, publicAsset, publicContents }) {
  const { body: html, headers } = await get(url, path)
  ok(headers['content-type']?.startsWith('text/html'))
  ok(html.includes(name))

  const script = html.match(/<script[^>]+src="([^"]*\/_next\/static\/[^"]+\.js[^"]*)"/)
  ok(script, `No JavaScript asset found in ${path}`)
  ok(script[1].startsWith(`${assetPrefix}/_next/static/`))

  const { headers: scriptHeaders } = await get(url, script[1].replaceAll('&amp;', '&'))
  ok(scriptHeaders['content-type']?.includes('javascript'))

  const stylesheet = html.match(/<link[^>]+href="([^"]*\/_next\/static\/[^"]+\.css[^"]*)"/)
  ok(stylesheet, `No stylesheet found in ${path}`)
  ok(stylesheet[1].startsWith(`${assetPrefix}/_next/static/`))

  const { headers: stylesheetHeaders } = await get(url, stylesheet[1].replaceAll('&amp;', '&'))
  ok(stylesheetHeaders['content-type']?.startsWith('text/css'))

  const { body: asset } = await get(url, publicAsset)
  strictEqual(asset.trim(), publicContents)
}

async function verifyZones (url) {
  await verifyZone(url, {
    path: '/',
    name: 'Frontend zone',
    assetPrefix: '',
    publicAsset: '/frontend.txt',
    publicContents: 'frontend asset'
  })
  await verifyZone(url, {
    path: '/blog',
    name: 'Blog zone',
    assetPrefix: '/blog',
    publicAsset: '/blog/blog.txt',
    publicContents: 'blog asset'
  })
}

test('serves multiple Next.js zones in development', async t => {
  const { root, runtime } = await prepareRuntime(t, 'multi-zones', false)
  const url = await startRuntime(t, runtime)

  await verifyZones(url)

  setHMRTriggerFile('services/blog/src/app/page.js')
  await verifyHMR(root, runtime, url, '/blog/_next/webpack-hmr', undefined, websocketHMRHandler)
})

test('builds and serves multiple Next.js zones in production', async t => {
  const { root, runtime } = await prepareRuntime(t, 'multi-zones', true)

  await buildRuntime(root)

  const url = await startRuntime(t, runtime)
  await verifyZones(url)
})
