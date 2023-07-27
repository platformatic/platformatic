'use strict'

import { getType } from './lib/gen-openapi.mjs'

const str = '{"anyOf":[{"type":"string"},{"items":{"type":"string"},"type":"array"}]}'
const obj = JSON.parse(str)

const output = getType(obj)
console.log(obj, output)
