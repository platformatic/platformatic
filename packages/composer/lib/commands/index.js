import { fetchOpenApiSchemas } from './openapi-fetch-schemas.js'

export function createCommands (id) {
  return {
    commands: {
      [`${id}:fetch-openapi-schemas`]: fetchOpenApiSchemas
    },
    help: {
      [`${id}:fetch-openapi-schemas`]: {
        usage: `${id}:fetch-openapi-schemas`,
        description: 'Fetch OpenAPI schemas from remote services'
      }
    }
  }
}
