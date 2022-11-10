import { stringify } from 'query-string'
import { fetchUtils } from 'ra-core'

/**
 * Maps react-admin queries to a platformatic powered REST API
 *
 * @see https://github.com/platformatic/platformatic
 *
 * @example
 *
 * getList          => GET http://my.api.url/posts?orderby.title=asc&offset=0&limit=24
 * getOne           => GET http://my.api.url/posts/123
 * getManyReference => GET http://my.api.url/posts?where.authorId.in=345,346
 * getMany          => GET http://my.api.url/posts?where.id.in=123,456,789
 * create           => POST http://my.api.url/posts/123
 * update           => PUT http://my.api.url/posts/123
 * updateMany       => PUT http://my.api.url/posts?where.id.in=123,456,789 http://my.api.url/posts?where.authorId.in=345,346
 * delete           => DELETE http://my.api.url/posts/123
 *
 * @example
 *
 * import * as React from "react";
 * import { Admin, Resource } from 'react-admin';
 * import platformaticRestProvider from 'ra-data-platformatic-rest';
 *
 * import { PostList } from './posts';
 *
 * const App = () => (
 *     <Admin dataProvider={platformaticRestProvider('http://my.api.url')}>
 *         <Resource name="posts" list={PostList} />
 *     </Admin>
 * );
 *
 * export default App;
 */

const formatFilters = (filters) =>
  filters
    ? Object.keys(filters).reduce((acc, param) => {
      acc[`where.${param}.eq`] = filters[param]

      return acc
    }, {})
    : {}

const parseWhereStatement = (where) =>
  Object.keys(where).reduce((acc, param) => {
    const [v] = Object.keys(where[param])
    acc[`where.${param}.${v}`] = Array.isArray(where[param][v]) ? where[param][v].join(',') : where[param][v]
    return acc
  }, {})

export default (apiUrl, httpClient = fetchUtils.fetchJson) => ({
  getList: (resource, params) => {
    const { page, perPage } = params.pagination
    const { field, order } = params.sort

    const query = {
      ...formatFilters(params.filter),
      ...(order && { [`orderby.${field}`]: order.toLowerCase() }),
      limit: perPage,
      offset: (page - 1) * perPage,
      totalCount: true
    }

    const url = `${apiUrl}/${resource}?${stringify(query)}`

    return httpClient(url).then(({ headers, json }) => {
      if (!headers.has('x-total-count')) {
        throw new Error(
          'The X-Total-Count header is missing in the HTTP Response. The jsonServer Data Provider expects responses for lists of resources to contain this header with the total number of results to build the pagination. If you are using CORS, did you declare X-Total-Count in the Access-Control-Expose-Headers header?'
        )
      }
      return {
        data: json,
        total: parseInt(headers.get('x-total-count').split('/').pop(), 10)
      }
    })
  },

  getOne: (resource, params) =>
    httpClient(`${apiUrl}/${resource}/${params.id}`).then(({ json }) => ({
      data: json
    })),

  getMany: (resource, params) => {
    const query = {
      'where.id.in': params.ids.join(',')
    }
    const url = `${apiUrl}/${resource}?${stringify(query)}`
    return httpClient(url).then(({ json }) => ({ data: json }))
  },

  getManyReference: (resource, params) => {
    const { page, perPage } = params.pagination
    const { field, order } = params.sort

    const query = {
      ...formatFilters(params.filter),
      [`where.${params.target}.eq`]: params.id,
      [`orderby.${field}`]: order.toLowerCase(),
      limit: perPage,
      offset: (page - 1) * perPage,
      totalCount: true
    }
    const url = `${apiUrl}/${resource}?${stringify(query)}`

    return httpClient(url).then(({ headers, json }) => {
      if (!headers.has('x-total-count')) {
        throw new Error(
          'The X-Total-Count header is missing in the HTTP Response. The jsonServer Data Provider expects responses for lists of resources to contain this header with the total number of results to build the pagination. If you are using CORS, did you declare X-Total-Count in the Access-Control-Expose-Headers header?'
        )
      }
      return {
        data: json,
        total: parseInt(headers.get('x-total-count').split('/').pop(), 10)
      }
    })
  },

  update: (resource, params) =>
    httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify(params.data)
    }).then(({ json }) => ({ data: json })),

  updateMany: (resource, params) => {
    if (!params?.where || Object.keys(params.where).length === 0) {
      throw new Error('where can not be empty')
    }
    const query = {
      ...parseWhereStatement(params.where)
    }
    return httpClient(`${apiUrl}/${resource}?${stringify(query)}`, {
      method: 'PUT',
      body: JSON.stringify(params.data)
    }).then(({ json }) => json)
  },

  create: (resource, params) =>
    httpClient(`${apiUrl}/${resource}`, {
      method: 'POST',
      body: JSON.stringify(params.data)
    }).then(({ json }) => ({
      data: { ...params.data, id: json.id }
    })),

  delete: (resource, params) =>
    httpClient(`${apiUrl}/${resource}/${params.id}`, {
      method: 'DELETE'
    }).then(({ json }) => ({ data: json })),

  // platformatic doesn't handle filters on DELETE route, so we fallback to calling DELETE n times instead
  // https://github.com/platformatic/platformatic/issues/250
  deleteMany: (resource, params) =>
    Promise.all(
      params.ids.map((id) =>
        httpClient(`${apiUrl}/${resource}/${id}`, {
          method: 'DELETE'
        })
      )
    ).then((responses) => ({ data: responses.map(({ json }) => json.id) }))
})
