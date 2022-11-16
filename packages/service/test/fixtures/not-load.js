'use strict'

const { promisify } = require('util')
const sleep = promisify(setTimeout)

module.exports = async function (app) {
  await sleep(60000) 
}
