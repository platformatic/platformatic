/*
  No port and no command, deliberately. `@platformatic/next` checks `server.port` before selecting
  a startup path in either mode, so this application provably starts nothing -- which the loader
  decides before boot and refuses. It is a copy of the `standalone` fixture because that one has to
  boot for the tests that use it.
*/
export default {
  module: '@platformatic/next'
}
