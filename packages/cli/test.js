'use strict'

import build from './api.js'

const client = build('http://127.0.0.1:3042')
console.log(await client.getHello({}))