export default {
  version: '2.99.0',
  up (config) {
    if (typeof config.plugins?.typescript !== 'undefined') {
      delete config.plugins.typescript
    }

    return config
  }
}
