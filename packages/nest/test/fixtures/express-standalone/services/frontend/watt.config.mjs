// These applications had no configuration file: v3 resolved the capability by detection
// and the runtime-level entrypoint handed them a listener. v4 keeps the detection but has
// no entrypoint to inherit a port from, and refuses an application that would start
// nothing -- so the port is declared, as scaffolding and migrate write it for a real one.
export default {
  module: '@platformatic/nest',
  server: {
    port: 0
  }
}
