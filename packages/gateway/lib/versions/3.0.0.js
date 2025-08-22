export default {
  version: '2.99.0',
  up (config) {
    if (typeof config.plugins?.typescript !== 'undefined') {
      delete config.plugins.typescript
    }

    if (typeof config.clients !== 'undefined') {
      delete config.clients
    }

    if (typeof config.composer !== 'undefined') {
      config.gateway = config.composer
      delete config.composer
    }

    if (typeof config.gateway?.services !== 'undefined') {
      config.gateway.applications = config.gateway.services
      delete config.gateway.services
    }

    return config
  }
}
