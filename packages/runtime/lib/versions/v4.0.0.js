export default {
  version: '3.99.0',
  up (config) {
    const applications = [...(config.applications ?? []), ...(config.services ?? []), ...(config.web ?? [])]
    let entrypoint = applications.find(application => application.id === config.entrypoint)

    if (!entrypoint && config.entrypoint && config.autoload?.path) {
      entrypoint = {
        id: config.entrypoint,
        path: `${config.autoload.path}/${config.entrypoint}`
      }
      config.applications ??= []
      config.applications.push(entrypoint)
    }

    if (entrypoint) {
      entrypoint.exposed ??= true
      entrypoint.server ??= config.server

      for (const application of applications) {
        application.exposed ??= application === entrypoint
      }
    }

    delete config.entrypoint
    delete config.server

    return config
  }
}
