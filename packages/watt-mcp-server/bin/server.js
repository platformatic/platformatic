#!/usr/bin/env node
'use strict'

import { startServer } from '../index.js'

startServer().catch(error => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})
