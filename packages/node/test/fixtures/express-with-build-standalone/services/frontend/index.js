import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import express from 'express'

export function build () {
  const app = express()
  const prefix = globalThis.platformatic?.basePath ?? ''

  app.get(ensureTrailingSlash(cleanBasePath(prefix)), (req, res) => {
    res.send({ production: process.env.NODE_ENV === 'production' })
  })

  return app
}
