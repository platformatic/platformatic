import { resolve } from 'node:path'
import {
  prepareRuntimeWithServices,
  setFixturesDir,
  updateFile,
  verifyDevelopmentFrontendStandalone,
  verifyDevelopmentFrontendWithAutodetectPrefix,
  verifyDevelopmentFrontendWithPrefix,
  verifyDevelopmentFrontendWithoutPrefix,
  verifyDevelopmentMode,
  verifyHTMLViaHTTP,
  verifyHTMLViaInject,
  verifyJSONViaHTTP,
  verifyJSONViaInject
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const hmrTriggerFile = 'services/frontend/src/app/page.js'

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.action) {
    case 'sync':
      resolveConnection()
      break
    case 'serverComponentChanges':
      resolveReload()
  }
}

export async function verifyDevelopmentFrontendWithExternalProxy (
  t,
  configuration,
  language,
  htmlContents,
  _hmrUrl,
  _hmrProtocol,
  _websocketHMRHandler,
  pauseTimeout
) {
  const { runtime, url } = await prepareRuntimeWithServices(
    t,
    configuration,
    false,
    language,
    '/frontend',
    pauseTimeout,
    async root => {
      await updateFile(resolve(root, 'services/composer/platformatic.json'), contents => {
        const json = JSON.parse(contents)
        json.composer.services[1].proxy = { prefix: '/frontend' }
        return JSON.stringify(json, null, 2)
      })
    }
  )

  await verifyHTMLViaHTTP(url, '/external-proxy/frontend', htmlContents)
  await verifyHTMLViaInject(runtime, 'external-proxy', '/external-proxy/frontend', htmlContents)

  await verifyJSONViaHTTP(url, '/external-proxy/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/external-proxy/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/external-proxy/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'external-proxy', 'GET', '/external-proxy/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'external-proxy', 'GET', '/external-proxy/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'external-proxy', 'GET', '/external-proxy/example', 200, { hello: 'foobar' })
}

const configurations = [
  {
    id: 'standalone',
    name: 'Next.js (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents: ['<script src="/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'Next.js (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'ts'
  },
  {
    id: 'composer-with-external-proxy',
    name: 'Next.js (in composer with external proxy)',
    check: verifyDevelopmentFrontendWithExternalProxy,
    htmlContents: ['<script src="/external-proxy/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-without-prefix',
    name: 'Next.js (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents: ['<script src="/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Next.js (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents: ['<script src="/nested/base/dir/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'server-side',
    name: 'Next.js RSC (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'Next.js (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations, '_next/webpack-hmr', undefined, websocketHMRHandler)
