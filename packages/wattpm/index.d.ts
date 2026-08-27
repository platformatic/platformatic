import type { ConfigContext } from '@platformatic/basic'
import type { PlatformaticRuntimeConfig } from './config.d.ts'

export type { PlatformaticRuntimeConfig } from './config.d.ts'

/*
  The shape of a root `watt.config.ts`. `$schema` is the stamped marker machine writers of the
  plain-object form emit; a hand-written file identifies itself by importing what it uses and does
  not carry one.
*/
export type WattConfig = PlatformaticRuntimeConfig

/*
  An identity function whose whole job is to type its argument, which is what gives a watt.config.ts
  editor completion and inline errors on a shape the loader would otherwise only reject at boot.

  Two overloads rather than a union parameter: the callback form is what gives the context
  parameter its type, and a single signature taking `WattConfig | ((ctx) => WattConfig)` would leave
  the callback's parameter implicitly `any` — which is the one thing the callback form exists for.
*/
export declare function defineConfig (config: WattConfig): WattConfig
export declare function defineConfig (
  callback: (context: ConfigContext) => WattConfig | Promise<WattConfig>
): (context: ConfigContext) => WattConfig | Promise<WattConfig>

export declare const version: string

export declare function main (...args: string[]): Promise<void>
