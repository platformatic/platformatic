interface Env {
  GREETING: string
  BACKEND: { fetch (input: Request | string): Promise<Response> }
}

export default {
  async fetch (request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === '/binding') {
      return env.BACKEND.fetch('http://ignored/from-binding')
    }

    return Response.json({ greeting: env.GREETING })
  }
}
