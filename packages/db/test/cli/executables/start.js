'use strict'

const { create } = require('../../../index.js')

create(process.argv.length > 2 ? process.argv.at(-1) : 'platformatic.db.json').then(app => {
  return app.start({ listen: true })
})
