import { WorkerEntrypoint } from 'cloudflare:workers'

interface Env {
  STAGE: string
  ONLY_TOP_LEVEL?: string
}

export default class extends WorkerEntrypoint<Env> {
  async fetch (request: Request): Promise<Response> {
    return Response.json({
      stage: this.env.STAGE,
      onlyTopLevel: this.env.ONLY_TOP_LEVEL ?? null,
      path: new URL(request.url).pathname
    })
  }
}
