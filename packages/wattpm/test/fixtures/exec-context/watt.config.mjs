import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/*
  Records the command it was evaluated under. A configuration with side effects is not something to
  write, but it is the only way to observe a context from outside: the command enumerator swallows
  errors, so a fixture that threw would be indistinguishable from one that worked.
*/
export default ctx => {
  writeFileSync(join(import.meta.dirname, 'observed-command.txt'), ctx.command)

  return { autoload: { path: './web' }, logger: { level: 'fatal' } }
}
