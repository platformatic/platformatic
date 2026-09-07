import { externalizePlatformaticGlobals } from '@platformatic/globals'

/**
 * Vite plugin that keeps `@platformatic/globals` external so the application
 * reads the runtime values the capability publishes rather than an inlined,
 * empty copy of the package.
 *
 * The `nitro` hook is picked up by builders layered on top of Vite (Nitro,
 * Nuxt, TanStack Start); plain Vite and Rollup builds are already covered
 * because the externalization also updates the shared Rollup configuration.
 */
export function platformaticGlobalsPlugin () {
  return {
    name: 'platformatic-globals',
    nitro: externalizePlatformaticGlobals
  }
}
