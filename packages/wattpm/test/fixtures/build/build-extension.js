import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

export default async function setup ({ root }) {
  const log = join(root, 'build-hooks.log')

  return {
    async preBuild ({ applicationId }) {
      await appendFile(log, `preBuild:${applicationId}\n`)
    },
    async onBuild ({ applicationId }, build) {
      await appendFile(log, `onBuild:before:${applicationId}\n`)
      const result = await build()
      await appendFile(log, `onBuild:after:${applicationId}\n`)
      return result
    },
    async postBuild ({ applicationId }) {
      await appendFile(log, `postBuild:${applicationId}\n`)
    }
  }
}
