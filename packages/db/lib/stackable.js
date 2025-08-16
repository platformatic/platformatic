import { ServiceStackable } from '@platformatic/service'
import { platformaticDatabase } from './application.js'
import { packageJson } from './schema.js'

export class DatabaseStackable extends ServiceStackable {
  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'db'
    this.version = packageJson.version

    this.applicationFactory = this.context.applicationFactory ?? platformaticDatabase
  }

  updateContext (context) {
    super.updateContext(context)

    if (this.context.isProduction && this.config.autogenerate) {
      this.config.autogenerate = false
    }
  }

  async getMeta () {
    const serviceMeta = await super.getMeta()
    const connectionString = this.config.db?.connectionString

    if (connectionString) {
      return {
        ...serviceMeta,
        connectionStrings: [connectionString]
      }
    }

    return serviceMeta
  }
}
