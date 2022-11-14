import renderer from 'react-test-renderer'
import { createMemoryHistory } from 'history'
import React from 'react'
import { Router } from 'react-router-dom'
import Navbar from './Navbar'

test('Navbar', () => {
  test('renders Navbar component', () => {
    const history = createMemoryHistory()
    renderer.create(
      <Router location={history.location} navigator={history}>
        <Navbar />
      </Router>
    )
    expect(screen.getByTestId('dashboard-link')).toHaveTextContent('Dashboard')
    expect(screen.getByTestId('graphiql-link')).toHaveTextContent('GraphiQL')
  })
})
