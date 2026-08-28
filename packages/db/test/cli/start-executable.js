import { create } from '../../index.js'

/*
  The directory rather than a file name when none is given: a v4 project's configuration is
  `watt.config.js` or one of its three siblings, and which of them depends on what the nearest
  package.json says about modules -- so the capability is asked to find it.
*/
create(process.argv.length > 2 ? process.argv.at(-1) : process.cwd()).then(app => {
  return app.start({ listen: true })
})
