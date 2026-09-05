import { externalizePlatformaticGlobals } from '@platformatic/globals'

export function platformaticNitroPlugin () {
  return {
    name: 'platformatic-globals',
    nitro: externalizePlatformaticGlobals
  }
}
