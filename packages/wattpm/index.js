import { readFileSync } from 'node:fs'

/*
  The package entry is what a watt.config.ts imports, so it is kept light on purpose: everything
  reachable from here is loaded in an evaluation worker on every boot and every dev reload. The CLI
  lives in ./lib/cli.js and is reached through a dynamic import, and the runtime schema — which
  pulls @platformatic/runtime — stays in ./lib/schema.js, where gen-schema already reads it.
*/
export * from './lib/define-config.js'

export const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version

export async function main (...args) {
  const { main: run } = await import('./lib/cli.js')

  // The CLI context is passed as `this` by bin/cli.js, so forward it rather than the arguments
  // alone.
  return run.apply(this, args)
}
