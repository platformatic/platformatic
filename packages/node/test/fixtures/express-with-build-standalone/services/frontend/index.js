import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath } from '@platformatic/globals'
import express from 'express'

export function build () {
  const app = express()
  const prefix = getBasePath({ throwOnMissing: false }) ?? ''

  app.get(ensureTrailingSlash(cleanBasePath(prefix)), (req, res) => {
    res.send({ production: process.env.NODE_ENV === 'production' })
  })

  return app
}
