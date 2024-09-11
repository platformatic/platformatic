import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import express from 'express'

const app = express()
const prefix = globalThis.platformatic?.basePath ?? ''

app.get(ensureTrailingSlash(cleanBasePath(prefix)), (req, res) => {
  res.send({ production: process.env.NODE_ENV === 'production' })
})

// This would likely fail if our code doesn't work
app.listen(1)
