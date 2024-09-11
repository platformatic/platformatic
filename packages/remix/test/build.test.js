import { fileURLToPath } from 'node:url'
import { internalServicesFiles, isCIOnWindows, verifyBuild } from '../../cli/test/helper.js'

const remixFiles = ['services/frontend/build/client/assets/entry.client-*.js']

const configurations = [
  { id: 'standalone', name: 'Remix (standalone)', files: [...remixFiles] },
  {
    only: isCIOnWindows,
    id: 'composer-with-prefix',
    name: 'Remix (in composer with prefix)',
    files: [...remixFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-without-prefix',
    name: 'Remix (in composer without prefix)',
    files: [...remixFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Remix (in composer with autodetected prefix)',
    files: [...remixFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-custom-commands',
    name: 'Remix (in composer with prefix using custom commands)',
    files: [...remixFiles, ...internalServicesFiles]
  }
]

verifyBuild(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
