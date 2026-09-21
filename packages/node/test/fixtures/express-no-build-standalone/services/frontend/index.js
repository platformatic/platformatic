import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath } from '@platformatic/globals'
import express from 'express'

const app = express()
const prefix = getBasePath({ throwOnMissing: false }) ?? ''

app.get(ensureTrailingSlash(cleanBasePath(prefix)), (req, res) => {
  res.send({ production: process.env.NODE_ENV === 'production' })
})

// This would likely fail if our code doesn't work
app.listen(0)
