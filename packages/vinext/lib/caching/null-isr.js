// This is provided to allow users to only rely on Cache Components and not the ISR cache
export class CacheHandler {
  async get () {}

  async set () {}

  async remove () {}

  async revalidateTag () {}
}

export default CacheHandler
