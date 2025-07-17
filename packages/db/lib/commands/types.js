import { loadConfiguration } from '@platformatic/utils'
import { schema } from '../schema.js'
import { execute } from '../types.js'

export async function generateTypes (logger, configFile, _args) {
  const config = await loadConfiguration(configFile, schema)

  const count = await execute({ logger, config })

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
