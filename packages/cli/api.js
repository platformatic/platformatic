// This client was generated by Platformatic from an OpenAPI specification.

// The base URL for the API. This can be overridden by calling `setBaseUrl`.
let baseUrl = ''
/**  @type {import('./api-types.d.ts').setBaseUrl} */
export const setBaseUrl = (newUrl) => { baseUrl = newUrl }

/**  @type {import('./api-types.d.ts').Api['getHello']} */
export const getHello = async (url, request) => {
  if (request === undefined) {
    request = url
    url = baseUrl
  }
  const response = await fetch(`${url}/hello?${new URLSearchParams(Object.entries(request || {})).toString()}`)

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return await response.json()
}

/**  @type {import('./api-types.d.ts').Api['getFoo']} */
export const getFoo = async (url, request) => {
  if (request === undefined) {
    request = url
    url = baseUrl
  }
  const response = await fetch(`${url}/foo?${new URLSearchParams(Object.entries(request || {})).toString()}`)

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return await response.json()
}

export default function build (url) {
  return {
    getHello: getHello.bind(url, ...arguments),
    getFoo: getFoo.bind(url, ...arguments)
  }
}