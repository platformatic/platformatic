import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFromConfig, graphqlRequest, startDatabaseApplications } from '../helper.js'

function toGatewayConfig (applications, entities = {}) {
  return {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      graphql: {},
      applications: applications.map(s => {
        const config = {
          id: s.name,
          origin: s.host,
          graphql: true
        }
        if (entities[s.name]) {
          config.graphql = {
            name: s.name,
            entities: entities[s.name]
          }
        }
        return config
      })
    }
  }
}

const defaultArgsAdapter = partialResults => {
  return { where: { id: { in: partialResults.map(r => r?.id) } } }
}

const entities = {
  artists: {
    Artist: {
      resolver: { name: 'artists' },
      pkey: 'id'
    }
  },
  movies: {
    Movie: {
      resolver: { name: 'movies' },
      pkey: 'id',
      fkeys: [
        {
          type: 'Artist',
          field: 'directorId',
          subgraph: 'artists',
          pkey: 'id',
          resolver: {
            name: 'artists',
            partialResults: partialResults => {
              return partialResults.map(r => ({ id: r.directorId }))
            }
          }
        }
      ]
    },
    Artist: {
      pkey: 'id',
      resolver: {
        name: 'getArtistsByMovies',
        argsAdapter: partialResults => {
          return { ids: partialResults.map(r => r.id) }
        }
      }
    }
  },
  songs: {
    Song: {
      resolver: { name: 'songs' },
      pkey: 'id',
      fkeys: [
        {
          type: 'Artist',
          field: 'singerId',
          pkey: 'id',
          subgraph: 'artists',
          resolver: {
            name: 'artists',
            partialResults: partialResults => {
              return partialResults.map(r => ({ id: r.singerId }))
            }
          }
        }
      ]
    },
    Artist: {
      pkey: 'id',
      resolver: {
        name: 'getArtistsBySongs',
        argsAdapter: partialResults => {
          return { ids: partialResults.map(r => r.id) }
        }
      }
    }
  }
}

test('should use queries and mutations on a single @platformatic/db application', async t => {
  const requests = [
    {
      query: '{ movies (limit:1) { title, year }}',
      expected: { movies: [{ title: 'Following', year: 1998 }] }
    },
    {
      query: '{ movies (limit:2, orderBy: [{field: year, direction: DESC }]) { title, year }}',
      expected: {
        movies: [
          { title: 'Oppenheimer', year: 2023 },
          { title: 'Tenet', year: 2020 }
        ]
      }
    },
    {
      query: `{ movies (
        where: { title: { like: "The%" } },
        limit: 1, 
        orderBy: [{field: year, direction: DESC },{field: title, direction: ASC }],
      ) { title, year }}`,
      expected: { movies: [{ title: 'The Dark Knight Rises', year: 2012 }] }
    },
    {
      query: 'mutation { saveMovie (input: { id: "a-new-movie", title: "A new movie" }) { id, title } }',
      expected: { saveMovie: { id: 'a-new-movie', title: 'A new movie' } }
    },
    {
      query: 'mutation createMovie($movie: MovieInput!) { saveMovie(input: $movie) { id, title } }',
      variables: { movie: { id: 'a-wonderful-movie', title: 'A wonderful movie' } },
      expected: { saveMovie: { id: 'a-wonderful-movie', title: 'A wonderful movie' } }
    }
  ]

  const applications = await startDatabaseApplications(t, [{ name: 'movies', jsonFile: 'with-entities.json' }])

  const gatewayConfig = toGatewayConfig(applications)
  gatewayConfig.gateway.graphql.defaultArgsAdapter = defaultArgsAdapter
  gatewayConfig.gateway.refreshTimeout = 0

  const gateway = await createFromConfig(t, gatewayConfig)
  const gatewayHost = await gateway.start({ listen: true })

  for (const request of requests) {
    let response

    response = await graphqlRequest({ query: request.query, variables: request.variables, host: applications[0].host })
    assert.deepEqual(
      response,
      request.expected,
      'should get expected result from db application for query\n' + request.query + '\nresponse' + JSON.stringify(response)
    )

    response = await graphqlRequest({ query: request.query, variables: request.variables, host: gatewayHost })
    assert.deepEqual(
      response,
      request.expected,
      'should get expected result from gateway application for query\n' +
        request.query +
        '\nresponse' +
        JSON.stringify(response)
    )
  }
})

test('should use queries and mutations on multiple @platformatic/db applications', async t => {
  const requests = [
    // query multiple applications
    {
      query:
        '{ songs (orderBy: [{field: title, direction: ASC }], limit: 1) { title, singer { firstName, lastName, profession } } }',
      expected: {
        songs: [
          { title: 'Every you every me', singer: { firstName: 'Brian', lastName: 'Molko', profession: 'Singer' } }
        ]
      }
    },

    // get all songs by singer
    {
      query: '{ artists (where: { profession: { eq: "Singer" }}) { lastName, songs { title, year } } }',
      expected: {
        artists: [
          {
            lastName: 'Pavarotti',
            songs: [{ title: 'Nessun dorma', year: 1992 }]
          },
          {
            lastName: 'Molko',
            songs: [
              { title: 'Every you every me', year: 1998 },
              { title: 'The bitter end', year: 2003 }
            ]
          },
          {
            lastName: 'Dickinson',
            songs: [
              { title: 'Fear of the dark', year: 1992 },
              { title: 'The trooper', year: 1983 }
            ]
          }
        ]
      }
    },

    // query more subgraph on same node
    {
      query: '{ artists (where: { profession: { eq: "Director" }}) { lastName, songs { title }, movies { title } } }',
      expected: {
        artists: [
          {
            lastName: 'Nolan',
            movies: [
              { title: 'Following' },
              { title: 'Memento' },
              { title: 'Insomnia' },
              { title: 'Batman Begins' },
              { title: 'The Prestige' },
              { title: 'The Dark Knight' },
              { title: 'Inception' },
              { title: 'The Dark Knight Rises' },
              { title: 'Interstellar' },
              { title: 'Dunkirk' },
              { title: 'Tenet' },
              { title: 'Oppenheimer' }
            ],
            songs: []
          },
          {
            lastName: 'Benigni',
            movies: [{ title: 'La vita é bella' }],
            songs: [{ title: 'Vieni via con me' }]
          }
        ]
      }
    },

    // double nested
    {
      query: '{ artists (where: { firstName: { eq: "Brian" } }) { songs { title, singer { firstName, lastName } } } }',
      expected: {
        artists: [
          {
            songs: [
              { title: 'Every you every me', singer: { firstName: 'Brian', lastName: 'Molko' } },
              { title: 'The bitter end', singer: { firstName: 'Brian', lastName: 'Molko' } }
            ]
          }
        ]
      }
    },

    // nested many times
    {
      query:
        '{ artists (where: { firstName: { eq: "Brian" } }) { songs { singer { songs { singer { songs { title } }} } } } }',
      expected: {
        artists: [
          {
            songs: [
              {
                singer: {
                  songs: [
                    { singer: { songs: [{ title: 'Every you every me' }, { title: 'The bitter end' }] } },
                    { singer: { songs: [{ title: 'Every you every me' }, { title: 'The bitter end' }] } }
                  ]
                }
              },
              {
                singer: {
                  songs: [
                    { singer: { songs: [{ title: 'Every you every me' }, { title: 'The bitter end' }] } },
                    { singer: { songs: [{ title: 'Every you every me' }, { title: 'The bitter end' }] } }
                  ]
                }
              }
            ]
          }
        ]
      }
    },

    // mutation: create
    {
      query: 'mutation { saveMovie (input: { id: "a-new-movie", title: "A new movie" }) { id, title } }',
      expected: { saveMovie: { id: 'a-new-movie', title: 'A new movie' } }
    },
    {
      query: 'mutation createMovie($movie: MovieInput!) { saveMovie(input: $movie) { title } }',
      variables: { movie: { id: 'a-wonderful-movie', title: 'A wonderful movie' } },
      expected: { saveMovie: { title: 'A wonderful movie' } }
    }
  ]

  const applications = await startDatabaseApplications(t, [
    { name: 'movies', jsonFile: 'with-entities.json' },
    { name: 'songs', jsonFile: 'with-entities.json' },
    { name: 'artists', jsonFile: 'bare-db.json' }
  ])

  const gatewayConfig = toGatewayConfig(applications, entities)

  gatewayConfig.gateway.graphql.defaultArgsAdapter = defaultArgsAdapter
  gatewayConfig.gateway.graphql.graphiql = true
  gatewayConfig.gateway.refreshTimeout = 0

  const gateway = await createFromConfig(t, gatewayConfig)
  const gatewayHost = await gateway.start({ listen: true })

  for (const request of requests) {
    const response = await graphqlRequest({ query: request.query, variables: request.variables, host: gatewayHost })

    assert.deepStrictEqual(
      response,
      request.expected,
      'should get expected result from gateway application for query\n' +
        request.query +
        '\nresponse' +
        JSON.stringify(response)
    )
  }
})
