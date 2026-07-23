export default function setup ({ health }) {
  health.registerRoutes(async app => {
    app.get('/inventory', async () => ({ ok: 1 }))
  })

  health.registerRoutes(async app => {
    app.get('/inventory', async () => ({ ok: 2 }))
  })
}
