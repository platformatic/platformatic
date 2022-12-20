#! /usr/bin/env node

import commist from 'commist'
import isMain from 'es-main'
import { red } from 'colorette'
import startLogin from './lib/login.js'
import { print } from './lib/utils.js'

const program = commist()
program.register('login', startLogin)

export async function login (argv) {
  const result = await program.parseAsync(argv)
  if (result) return startLogin(result, print).catch(exit)
}

/* c8 ignore next 5 */
function exit (err) {
  print(`${red('Unable to authenticate:')}`, console.error)
  print(`\n\t${err.message}`, console.error)
  process.exit(1)
}

if (isMain(import.meta)) {
  await login(process.argv.splice(2))
}
