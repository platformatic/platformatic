import { fileURLToPath } from 'node:url'
import { internalServicesFiles, verifyBuild } from '../../cli/test/helper.js'

const nextFiles = ['services/frontend/.next//server/app/index.html']
const nextSSRFiles = ['services/frontend/.next/server/app/direct/route.js']

const configurations = [
  { id: 'standalone', name: 'Next.js (standalone)', files: [...nextFiles] },
  {
    id: 'composer-with-prefix',
    name: 'Next.js (in composer with prefix)',
    files: [...nextFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-without-prefix',
    name: 'Next.js (in composer without prefix)',
    files: [...nextFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Next.js (in composer with autodetected prefix)',
    files: [...internalServicesFiles]
  },
  {
    id: 'server-side',
    name: 'Next.js RSC (in composer with prefix)',
    files: [...nextFiles, ...nextSSRFiles, ...internalServicesFiles]
  },
  {
    id: 'composer-custom-commands',
    name: 'Next.js (in composer with prefix using custom commands)',
    files: [...nextFiles, ...internalServicesFiles]
  }
]

verifyBuild(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
