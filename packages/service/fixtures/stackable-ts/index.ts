import { platformaticService, Stackable, PlatformaticServiceConfig } from '../../index'

function buildStackable () : Stackable<PlatformaticServiceConfig> {
  async function myApp (app, opts) {
    await platformaticService(app, opts)
  }

  myApp.schema = platformaticService.configManagerConfig.schema
  myApp.configType = 'myApp'
  myApp.configManagerConfig = platformaticService.configManagerConfig

  return myApp
}

export default buildStackable()

