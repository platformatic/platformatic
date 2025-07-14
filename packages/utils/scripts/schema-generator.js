#!/usr/bin/env node

import { resolve } from 'node:path'

const { schema } = await import(resolve(process.cwd(), process.argv[2]))
console.log(JSON.stringify(schema, null, 2))
