import { rejects } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'

/*
  `@platformatic/next` checks `server.port` before selecting a startup path, in development and in
  production alike, so an application declaring neither a port nor a command for the running mode
  provably starts nothing. v3 booted it anyway and left the runtime one application short without
  saying so; v4 decides it before boot, from configuration alone, and refuses.
*/
for (const production of [false, true]) {
  const mode = production ? 'production' : 'development'

  test(`a managed Next.js application that would start nothing is refused in ${mode}`, async t => {
    await rejects(
      () =>
        prepareRuntime({
          t,
          root: path.resolve(import.meta.dirname, './fixtures/starts-nothing'),
          production
        }),
      error => {
        return (
          error.code === 'PLT_APPLICATION_STARTS_NOTHING' &&
          error.message.includes('Application frontend would start nothing') &&
          error.message.includes('@platformatic/next')
        )
      }
    )
  })
}
