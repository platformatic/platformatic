'use strict'

// Note: use `plt:` prefix or some sort of unique keying system here
// DO NOT USE Symbol or Symbol.for as they cannot be transferred via Workers
module.exports = {
  // The entrypoint service exposed by the runtime
  runtimeEntrypoint: 'plt:runtimeEntrypoint',

  // An alternative access point to a service.
  // It should be typically different from the default service.plt.local.
  // It should be a full URL string
  accessPoint: 'plt:accessPoint'
}
