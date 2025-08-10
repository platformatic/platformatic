# Frontend client

Create implementation and type files that exposes a client for a remote OpenAPI server, that uses `fetch` and can run in any browser.

## Generating the Client 

To create a client for a remote OpenAPI API, use the following command:

```bash
$ npx --package @platformatic/client-cli plt-client http://example.com/to/schema/file --frontend --language <language> --name <clientname>
```

- `<language>`: Can be either `js` (JavaScript) or `ts` (TypeScript).
- `<clientname>`: The name of the generated client files. Defaults to `api`.

This command creates two files: `clientname.js` (or `clientname.ts`) and `clientname-types.d.ts` for TypeScript types. 

## Usage

The general implementation exports named operations and a factory object. 

### Named operations

```js
import { setBaseUrl, getMovies } from './api.js'

setBaseUrl('http://my-server-url.com') // modifies the global `baseUrl` variable

const movies = await getMovies({})
console.log(movies)
```

### Factory

The factory object is called `build` and can be used as follows:

```js
import build from './api.js'

const client = build('http://my-server-url.com')

const movies = await client.getMovies({})
console.log(movies)
```

You can use both named operations and the factory in the same file. They can work on different hosts, so the factory does _not_ use the global `setBaseUrl` function.

### Default fetch params

You can set additional parameters to be passed to the client `fetch` instance.

```js
import build from './api.js'
import { setDefaultFetchParams } from './api.js'

setDefaultFetchParams({
    keepalive: false,
    mode: 'no-cors'
})

// `fetch` will be called with the `keepalive` and `mode` method as defined above
const movies = await getMovies({})
console.log(movies)
```

### Default Headers

You can set headers that will be sent along with all the requests made by the client. This is useful, for instance, for authentication.

```js
import build from './api.js'
import { setBaseUrl, getMovies } from './api.js'

setBaseUrl('http://my-server-url.com') // modifies the global `baseUrl` variable

setDefaultHeaders({
    authorization: 'Bearer MY_TOKEN'
})

const movies = await getMovies({})
console.log(movies)
```

With the factory approach you'll set up `headers` as option in the `build` method

```js
import build from './api.js'


const client = build('http://my-server-url.com', {
  headers: {
    authorization: 'Bearer MY_TOKEN'
  }
})

const movies = await client.getMovies({})
console.log(movies)
```



## Generated Code

### TypeScript Types

The type file will look like this:

```ts
export interface GetMoviesRequest {
  'limit'?: number;
  'offset'?: number;
  // ... all other options
}

interface GetMoviesResponseOK {
  'id': number;
  'title': string;
}
export interface Api {
  setBaseUrl(newUrl: string): void;
  setDefaultHeaders(headers: Object): void;
  setDefaultFetchParams(fetchParams: RequestInit): void;
  getMovies(req: GetMoviesRequest): Promise<Array<GetMoviesResponseOK>>;
  // ... all operations listed here
}

type PlatformaticFrontendClient = Omit<Api, 'setBaseUrl'>
export default function build(url: string): PlatformaticFrontendClient
```

### JavaScript Implementation 

The *javascript* implementation will look like this

```js
let baseUrl = ''
let defaultHeaders = ''
/**  @type {import('./api-types.d.ts').Api['setBaseUrl']} */
export const setBaseUrl = (newUrl) => { baseUrl = newUrl }

/**  @type {import('./api-types.d.ts').Api['setDefaultHeaders']} */
export const setDefaultHeaders = (headers) => { defaultHeaders = headers }

/**  @type {import('./${name}-types.d.ts').${camelCaseName}['setDefaultFetchParams']} */
export const setDefaultFetchParams = (fetchParams) => { defaultFetchParams = fetchParams }

/**  @type {import('./api-types.d.ts').Api['getMovies']} */
export const getMovies = async (request) => {
  return await _getMovies(baseUrl, request)
}
async function _createMovie (url, request) {
  const response = await fetch(`${url}/movies/`, {
    method:'post',
    body: JSON.stringify(request),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return await response.json()
}

/**  @type {import('./api-types.d.ts').Api['createMovie']} */
export const createMovie = async (request) => {
  return await _createMovie(baseUrl, request)
}
// ...

export default function build (url) {
  return {
    getMovies: _getMovies.bind(url, ...arguments),
    // ...
  }
}
```

### TypeScript Implementation 

The *typescript* implementation will look like this:

```ts
import type { Api } from './api-types'
import type * as Types from './api-types'

let baseUrl = ''
let defaultHeaders = {}
let defaultFetchParams = {}

export const setBaseUrl = (newUrl: string) : void => { baseUrl = newUrl }

export const setDefaultHeaders = (headers: Object) => { defaultHeaders = headers }

export const setDefaultFetchParams = (fetchParams: RequestInit): void => { defaultFetchParams = fetchParams }

const _getMovies = async (url: string, request: Types.GetMoviesRequest) => {
  const response = await fetch(`${url}/movies/?${new URLSearchParams(Object.entries(request || {})).toString()}`)

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return await response.json()
}

export const getMovies: Api['getMovies'] = async (request: Types.GetMoviesRequest) => {
  return await _getMovies(baseUrl, request)
}
// ...
export default function build (url) {
  return {
    getMovies: _getMovies.bind(url, ...arguments),
    // ...
  }
}
```

