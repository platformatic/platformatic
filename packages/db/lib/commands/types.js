import { loadConfiguration } from '@platformatic/foundation'
import { schema } from '../schema.js'
import { execute } from '../types.js'
import { dirname } from 'node:path'
import { transform } from '../config-transform.js'

export async function generateTypes (logger, configFile, _args) {
  const appDir = dirname(configFile)
  const config = await transform(await loadConfiguration(configFile, schema))

  const count = await execute({ logger, config, appDir })

  if (count === 0) {
    logger.warn('No entities found in your schema. Types were NOT generated.')
    logger.warn('Make sure you have applied all the migrations and try again.')
  }
}

export const helpFooter = `
As a result of executing this command, the Platformatic DB will generate a \`types\` folder with a typescript file for each database entity. It will also generate a \`plt-env.d.ts\` file that injects the types into the Application instance.

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
`
