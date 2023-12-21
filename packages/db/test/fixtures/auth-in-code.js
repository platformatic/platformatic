'use strict'

module.exports = async function (app) {
  app.platformatic.addRulesForRoles([{
    role: 'user',
    entity: 'page',
    find: true,
    delete: false,
    defaults: {
      userId: 'X-PLATFORMATIC-USER-ID'
    },
    save: {
      checks: {
        userId: 'X-PLATFORMATIC-USER-ID'
      }
    }
  }, {
    role: 'anonymous',
    entity: 'page',
    find: false,
    delete: false,
    save: false
  }])
}
