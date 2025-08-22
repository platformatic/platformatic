export default {
  version: '2.99.0',
  up (config) {
    if (typeof config.plugins?.typescript !== 'undefined') {
      delete config.plugins.typescript
    }

    if (typeof config.clients !== 'undefined') {
      delete config.clients
    }

    if (typeof config.composer?.services !== 'undefined') {
      config.composer.applications = config.composer.services
      delete config.composer.services
    }

    return config
  }
}
