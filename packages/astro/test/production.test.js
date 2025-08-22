import { resolve } from 'node:path'
import {
  internalApplicationsFiles,
  isCIOnWindows,
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyFrontendAPIOnPrefix,
  verifyFrontendAPIOnRoot,
  verifyFrontendOnAutodetectedPrefix,
  verifyFrontendOnPrefix,
  verifyFrontendOnRoot,
  verifyPlatformaticGateway,
  verifyPlatformaticService
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const files = ['services/frontend/dist/index.html']
const filesSSR = ['services/frontend/dist/server/entry.mjs']

const configurations = [
  {
    id: 'standalone',
    name: 'Astro (standalone)',
    files,
    checks: [verifyFrontendOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Astro (in composer with prefix)',
    files: [...files, ...internalApplicationsFiles],
    checks: [verifyFrontendOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'composer-without-prefix',
    name: 'Astro (in composer without prefix)',
    files,
    checks: [verifyFrontendOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Astro (in composer with autodetected prefix)',
    files,
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    // This is skipped due to https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6
    skip: true,
    id: 'composer-custom-commands',
    name: 'Astro (in composer with prefix using custom commands)',
    files,
    checks: [verifyFrontendOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'ssr-standalone',
    name: 'Astro SSR (standalone)',
    files: filesSSR,
    checks: [verifyFrontendOnRoot, verifyFrontendAPIOnRoot],
    language: 'js',
    prefix: ''
  },
  {
    only: isCIOnWindows,
    id: 'ssr-with-prefix',
    name: 'Astro SSR (in composer with prefix)',
    files: filesSSR,
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'ssr-without-prefix',
    name: 'Astro SSR (in composer without prefix)',
    files: filesSSR,
    checks: [verifyFrontendOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Astro SSR (in composer with autodetected prefix)',
    files: filesSSR,
    checks: [verifyFrontendOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'ssr-custom-commands',
    name: 'Astro SSR (in composer with prefix using custom commands)',
    files: filesSSR,
    checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
