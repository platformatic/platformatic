import { ServiceCapability } from '@platformatic/service'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export async function create (root, config, context) {
  await writeFile(
    resolve(root, 'module-created.json'),
    JSON.stringify({ root, sourcePath: context.sourcePath }),
    'utf8'
  )

  return new ServiceCapability(root, config, {
    ...context,
    applicationFactory: async app => {
      app.get('/module', async () => ({ running: true }))
    }
  })
}
