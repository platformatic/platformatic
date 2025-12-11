import { enhanceNextConfig } from '../index.js'

export const adapter = {
  name: '@platformatic/next/adapter',
  async modifyConfig (config) {
    return enhanceNextConfig(config)
  }
}

export default adapter
