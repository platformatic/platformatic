import { getAdapterPath } from '@platformatic/next'

const nextConfig = {
  experimental: {
    adapterPath: getAdapterPath()
  }
}

export default nextConfig
