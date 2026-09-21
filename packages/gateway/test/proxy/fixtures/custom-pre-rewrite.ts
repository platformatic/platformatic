export default {
  preRewrite (url: string, params: Record<string, string>, prefix: string) {
    if (prefix !== '/api') {
      return url
    }

    return url.replace(params['*'], 'rewritten')
  }
}
