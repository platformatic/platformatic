export default {
  version: '3.99.0',
  up (config) {
    const schema = config.$schema
    const isRuntimeSchema =
      !schema ||
      /(?:^|\/)(?:@platformatic\/)?runtime(?:\/|$)/.test(schema) ||
      /(?:^|\/)wattpm(?:\/|$)/.test(schema)

    // Standalone application configurations are wrapped by Runtime and pass
    // through this upgrade chain. Their capability-owned server must survive.
    if (!isRuntimeSchema) {
      return config
    }

    for (const section of ['applications', 'services', 'web']) {
      for (const application of config[section] ?? []) {
        delete application.server
      }
    }

    for (const application of Object.values(config.autoload?.mappings ?? {})) {
      delete application.server
    }

    delete config.entrypoint
    delete config.server

    return config
  }
}
