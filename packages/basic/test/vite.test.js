'use strict'

import { safeRemove, withResolvers } from '@platformatic/utils'
import assert from 'node:assert'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import WebSocket from 'ws'
import { createRuntime, fixturesDir, verifyViaHTTP, verifyViaInject } from './helper.js'
async function prepareHMR (t, root) {
  const versionFile = resolve(fixturesDir, root, 'version.js')
  await writeFile(versionFile, 'export const version = 1', 'utf-8')

  t.after(() => safeRemove(versionFile))
  return versionFile
}

async function verifyHTMLViaHTTP (url, basePath) {
  const { statusCode, headers, body } = await request(`${url}/${basePath}`)
  const html = await body.text()

  assert.deepStrictEqual(statusCode, 200)
  assert.deepStrictEqual(headers['content-type'], 'text/html')
  assert.ok(html.includes('<title>Vite App</title>'))
  assert.ok(html.includes(`<script type="module" src="${basePath ? `/${basePath}` : ''}/main.js"></script>`))
}

export async function verifyHTMLViaInject (app, serviceId, basePath) {
  const {
    statusCode,
    headers,
    body: html,
  } = await app.inject(serviceId, { method: 'GET', url: basePath ? `/${basePath}/` : '/' })

  assert.deepStrictEqual(statusCode, 200)
  assert.deepStrictEqual(headers['content-type'], 'text/html')
  assert.ok(html.includes('<title>Vite App</title>'))
  assert.ok(html.includes(`<script type="module" src="${basePath ? `/${basePath}` : ''}/main.js"></script>`))
}

async function verifyHMR (url, basePath, versionFile) {
  const webSocket = new WebSocket(`${url.replace('http:', 'ws:')}${basePath ? `/${basePath}` : ''}/`, 'vite-hmr')

  const connection = withResolvers()

  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      webSocket.terminate()
      connection.reject(new Error('Timeout while waiting for HMR reload'))
      reject(new Error('Timeout while waiting for HMR reload'))
    }, 10000)

    webSocket.on('error', err => {
      clearTimeout(timeout)
      connection.reject(err)
      reject(err)
    })

    webSocket.on('message', data => {
      const message = JSON.parse(data)

      switch (message.type) {
        case 'connected':
          setTimeout(() => {
            connection.resolve()
          }, 1000)
          break
        case 'full-reload':
          clearTimeout(timeout)
          setImmediate(() => {
            webSocket.terminate()
            resolve()
          })
      }
    })
  })

  await connection.promise
  await writeFile(versionFile, 'export const version = 2', 'utf-8')
  return promise
}

test('can detect and start a Vite application', async t => {
  const versionFile = await prepareHMR(t, 'vite/standalone')
  const { url } = await createRuntime(t, 'vite/standalone/platformatic.runtime.json')

  await verifyHTMLViaHTTP(url, '')
  await verifyHMR(url, '', versionFile)
})

test('can detect and start a Vite application when exposed in a composer with a prefix', async t => {
  const versionFile = await prepareHMR(t, 'vite/composer-with-prefix')
  const { runtime, url } = await createRuntime(t, 'vite/composer-with-prefix/platformatic.runtime.json')

  await verifyHTMLViaHTTP(url, 'frontend')
  await verifyHTMLViaInject(runtime, 'main', 'frontend')
  await verifyHMR(url, 'frontend', versionFile)

  await verifyViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start a Vite application when exposed in a composer without a prefix', async t => {
  const versionFile = await prepareHMR(t, 'vite/composer-without-prefix')
  const { runtime, url } = await createRuntime(t, 'vite/composer-without-prefix/platformatic.runtime.json')

  await verifyHTMLViaHTTP(url, '')
  await verifyHTMLViaInject(runtime, 'main', '')
  await verifyHMR(url, '', versionFile)

  await verifyViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})

test('can detect and start a Vite application when exposed in a composer with a custom config and by autodetecting the prefix', async t => {
  const versionFile = await prepareHMR(t, 'vite/composer-autodetect-prefix')
  const { runtime, url } = await createRuntime(t, 'vite/composer-autodetect-prefix/platformatic.runtime.json')

  await verifyHTMLViaHTTP(url, 'nested/base/dir')
  await verifyHTMLViaInject(runtime, 'main', 'nested/base/dir')
  await verifyHMR(url, 'nested/base/dir', versionFile)

  await verifyViaHTTP(url, '/plugin', 200, { ok: true })
  await verifyViaHTTP(url, '/frontend/plugin', 200, { ok: true })
  await verifyViaHTTP(url, '/service/direct', 200, { ok: true })

  await verifyViaInject(runtime, 'main', 'GET', 'plugin', 200, { ok: true })
  await verifyViaInject(runtime, 'main', 'GET', '/frontend/plugin', 200, { ok: true })
  await verifyViaInject(runtime, 'service', 'GET', '/direct', 200, { ok: true })
})
