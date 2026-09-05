/*
  defineConfig is an identity function: its whole job is to type its argument, which is what gives
  a watt.config.ts editor completion and inline errors on a shape the loader will otherwise only
  reject at boot.

  It also accepts a function, sync or async. Nothing happens to it here — classification rule 1 in
  the loader calls it once with the config context and classifies its resolved value — so the
  runtime behaviour of the two forms is identical and the overload exists to type the callback's
  parameter.

  This module deliberately imports nothing. A root config file is evaluated in a worker on every
  boot and every dev reload, so anything reachable from this import is paid for there: reaching the
  CLI entry from here would have cost about a second and a half per load.
*/
export function defineConfig (config) {
  return config
}
