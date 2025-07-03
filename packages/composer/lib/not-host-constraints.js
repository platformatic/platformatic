'use strict'

module.exports = {
  name: 'notHost',
  storage: () => {
    const store = []

    return {
      get (host) {
        if (typeof host === 'string') {
          for (const [hosts, value] of store) {
            if (!hosts.includes(host)) {
              return value
            }
          }
        }

        return null
      },
      set: (hosts, value) => {
        store.push([hosts, value])
      },
      store
    }
  },
  deriveConstraint: req => {
    return req.headers.host || req.headers[':authority']
  },
  mustMatchWhenDerived: false,
  validate () {
    return true
  }
}
