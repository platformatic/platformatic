import { vi } from 'vitest'
import restClient from '.'

describe('Data Simple REST Client', () => {
  describe('getList', () => {
    it('should compose the right URL', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({
            'x-total-count': '42'
          })
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      await client.getList('posts', {
        filter: {
          username: 'jack'
        },
        pagination: {
          page: 1,
          perPage: 10
        },
        sort: {
          field: 'title',
          order: 'desc'
        }
      })

      expect(httpClient).toHaveBeenCalledWith(
        'http://localhost:3000/posts?limit=10&offset=0&orderby.title=desc&totalCount=true&where.username.eq=jack'
      )
    })

    it("should return 'total' and 'data' fields", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({
            'x-total-count': '42'
          }),
          json: {
            test: 'prop'
          }
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      const response = await client.getList('posts', {
        filter: {},
        pagination: {
          page: 1,
          perPage: 10
        },
        sort: {}
      })

      expect(response).toMatchObject({
        total: 42,
        data: {
          test: 'prop'
        }
      })
    })

    it("should throw an error if the response doesn't contain the 'x-total-count' header", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({}),
          json: [{ id: 1 }],
          status: 200
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.getList('posts', {
          filter: {},
          pagination: {
            page: 1,
            perPage: 10
          },
          sort: {
            field: 'title',
            order: 'desc'
          }
        })
      } catch (e) {
        expect(e.message).toBe(
          'The X-Total-Count header is missing in the HTTP Response. The jsonServer Data Provider expects responses for lists of resources to contain this header with the total number of results to build the pagination. If you are using CORS, did you declare X-Total-Count in the Access-Control-Expose-Headers header?'
        )
      }
    })

    it('should throw if the request throws', async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.getList('posts', {
          filter: {},
          pagination: {
            page: 1,
            perPage: 10
          },
          sort: {
            field: 'title',
            order: 'desc'
          }
        })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })

  describe('getOne', () => {
    it('should compose the right URL', async () => {
      const httpClient = vi.fn(() => Promise.resolve({}))
      const client = restClient('http://localhost:3000', httpClient)

      await client.getOne('posts', { id: 1 })
      expect(httpClient).toHaveBeenCalledWith('http://localhost:3000/posts/1')
    })

    it('should return the data field', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: {
            userId: 1
          }
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      const response = await client.getOne('posts', { id: 1 })
      expect(response).toMatchObject({ data: { userId: 1 } })
    })

    it('should throw if the request throws', async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.getOne('posts', { id: 1 })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })

  describe('getMany', () => {
    it('should compose the right URL', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: []
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      await client.getMany('posts', { ids: [1, 2] })
      expect(httpClient).toHaveBeenCalledWith(
        'http://localhost:3000/posts?where.id.in=1%2C2'
      )
    })

    it('should return the data field', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: [
            {
              userId: 1
            },
            {
              userId: 2
            }
          ]
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      const response = await client.getMany('posts', { ids: [1, 2] })
      expect(response).toMatchObject({
        data: [
          {
            userId: 1
          },
          {
            userId: 2
          }
        ]
      })
    })

    it('should throw if the request throws', async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.getMany('posts', { ids: [1, 2] })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })

  describe('getManyReference', () => {
    it('should compose the right URL', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({
            'x-total-count': '42'
          })
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      await client.getManyReference('comments', {
        target: 'postId',
        id: 123,
        filter: {
          username: 'jack'
        },
        pagination: {
          page: 1,
          perPage: 10
        },
        sort: {
          field: 'title',
          order: 'desc'
        }
      })
      expect(httpClient).toHaveBeenCalledWith(
        'http://localhost:3000/comments?limit=10&offset=0&orderby.title=desc&totalCount=true&where.postId.eq=123&where.username.eq=jack'
      )
    })

    it("should throw an error if the response doesn't contain the 'x-total-count' header", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({}),
          json: [{ id: 1 }],
          status: 200
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.getManyReference('comments', {
          target: 'postId',
          id: 123,
          filter: {
            username: 'jack'
          },
          pagination: {
            page: 1,
            perPage: 10
          },
          sort: {
            field: 'title',
            order: 'desc'
          }
        })
      } catch (e) {
        expect(e.message).toBe(
          'The X-Total-Count header is missing in the HTTP Response. The jsonServer Data Provider expects responses for lists of resources to contain this header with the total number of results to build the pagination. If you are using CORS, did you declare X-Total-Count in the Access-Control-Expose-Headers header?'
        )
      }
    })

    it("should return 'total' and 'data' fields", async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({
            'x-total-count': '42'
          }),
          json: {
            test: 'prop'
          }
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      const response = await client.getManyReference('comments', {
        target: 'postId',
        id: 123,
        filter: {
          username: 'jack'
        },
        pagination: {
          page: 1,
          perPage: 10
        },
        sort: {
          field: 'title',
          order: 'desc'
        }
      })

      expect(response).toMatchObject({
        total: 42,
        data: {
          test: 'prop'
        }
      })
    })

    it('should throw if the request throws', async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.getList('posts', {
          target: 'postId',
          id: 123,
          filter: {
            username: 'jack'
          },
          pagination: {
            page: 1,
            perPage: 10
          },
          sort: {
            field: 'title',
            order: 'desc'
          }
        })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })

  describe('update', () => {
    it('should compose the right URL and pass the proper method and body params', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: []
        })
      )
      const client = restClient('http://localhost:3000', httpClient)
      const data = {
        name: 'jack'
      }
      await client.update('posts', { id: 1, data })
      expect(httpClient).toHaveBeenCalledWith('http://localhost:3000/posts/1', {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    })

    it('should return the data field', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: {
            userId: 1,
            name: 'jack'
          }
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      const response = await client.update('posts', { id: 1, name: 'jack' })
      expect(response).toMatchObject({
        data: {
          userId: 1,
          name: 'jack'
        }
      })
    })

    it('should throw if the request throws', async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.update('posts', { id: 1, data: { whatever: '' } })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })

  describe('updateMany', () => {
    it('should compose the right URL and pass the proper method and body params', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: []
        })
      )
      const client = restClient('http://localhost:3000', httpClient)
      const data = {
        name: 'jack'
      }
      await client.updateMany('posts', { ids: [1, 2], data })
      expect(httpClient).toHaveBeenNthCalledWith(
        1,
        'http://localhost:3000/posts/1',
        {
          method: 'PUT',
          body: JSON.stringify(data)
        }
      )
      expect(httpClient).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3000/posts/2',
        {
          method: 'PUT',
          body: JSON.stringify(data)
        }
      )
    })

    it('should return the data field with the updated ids', async () => {
      const httpClient = vi.fn()
      httpClient.mockImplementationOnce(() =>
        Promise.resolve({
          json: {
            id: 1,
            name: 'jack'
          }
        })
      )
      httpClient.mockImplementationOnce(() =>
        Promise.resolve({
          json: {
            id: 2,
            name: 'jack'
          }
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      const response = await client.updateMany('posts', {
        ids: [1, 2],
        data: {}
      })
      expect(response).toMatchObject({
        data: [1, 2]
      })
    })

    it('should throw if one of the many updates throws', async () => {
      const httpClient = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.update('posts', { id: 1, data: { whatever: '' } })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })

  describe('create', () => {
    it('should compose the right URL and pass the proper method and body params', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: []
        })
      )
      const client = restClient('http://localhost:3000', httpClient)
      const data = {
        name: 'jack'
      }
      await client.create('posts', { data })
      expect(httpClient).toHaveBeenCalledWith('http://localhost:3000/posts', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    })

    it('should return the data field with the created id', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: {
            id: 1,
            name: 'jack'
          }
        })
      )
      const data = {
        name: 'jack'
      }

      const client = restClient('http://localhost:3000', httpClient)
      const response = await client.create('posts', {
        data
      })
      expect(response).toMatchObject({
        data: {
          id: 1,
          name: 'jack'
        }
      })
    })

    it('should throw if the request throws', async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)
      const data = {
        name: 'jack'
      }

      try {
        await client.create('posts', { data })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })

  describe('delete', () => {
    it('should compose the right URL and pass the proper method param', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: []
        })
      )
      const client = restClient('http://localhost:3000', httpClient)
      await client.delete('posts', { id: 1 })
      expect(httpClient).toHaveBeenCalledWith('http://localhost:3000/posts/1', {
        method: 'DELETE'
      })
    })

    it('should return the data field with the deleted item', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: {
            id: 1,
            name: 'jack'
          }
        })
      )

      const client = restClient('http://localhost:3000', httpClient)
      const response = await client.delete('posts', { id: 1 })
      expect(response).toMatchObject({
        data: {
          id: 1,
          name: 'jack'
        }
      })
    })

    it('should throw if the request throws', async () => {
      const httpClient = vi.fn(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.delete('posts', { id: 1 })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })

  describe('deleteMany', () => {
    it('should compose the right URL and pass the proper method param', async () => {
      const httpClient = vi.fn(() =>
        Promise.resolve({
          json: []
        })
      )
      const client = restClient('http://localhost:3000', httpClient)
      await client.deleteMany('posts', { ids: [1, 2] })
      expect(httpClient).toHaveBeenNthCalledWith(
        1,
        'http://localhost:3000/posts/1',
        {
          method: 'DELETE'
        }
      )
      expect(httpClient).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3000/posts/2',
        {
          method: 'DELETE'
        }
      )
    })

    it('should return the data field with the deleted ids', async () => {
      const httpClient = vi.fn()
      httpClient.mockImplementationOnce(() =>
        Promise.resolve({
          json: {
            id: 1,
            name: 'jack'
          }
        })
      )
      httpClient.mockImplementationOnce(() =>
        Promise.resolve({
          json: {
            id: 2,
            name: 'jack'
          }
        })
      )
      const client = restClient('http://localhost:3000', httpClient)

      const response = await client.deleteMany('posts', {
        ids: [1, 2],
        data: {}
      })
      expect(response).toMatchObject({
        data: [1, 2]
      })
    })

    it('should throw if one of the many deletes throws', async () => {
      const httpClient = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('error')))
      const client = restClient('http://localhost:3000', httpClient)

      try {
        await client.deleteMany('posts', { ids: [1, 2] })
      } catch (e) {
        expect(e.message).toBe('error')
      }
    })
  })
})
