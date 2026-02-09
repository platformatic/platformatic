export default {
  version: '2.99.0',
  up (config) {
    if (typeof config.plugins?.typescript !== 'undefined') {
      delete config.plugins.typescript
    }

    if (typeof config.clients !== 'undefined') {
      delete config.clients
    }

    return config
  }
}
