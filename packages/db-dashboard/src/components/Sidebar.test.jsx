import renderer from 'react-test-renderer'
import { createMemoryHistory } from 'history'
import React from 'react'
import { Router } from 'react-router-dom'
import Sidebar from './Sidebar'

test('Sidebar', () => {
  test('renders Sidebar component', () => {
    const history = createMemoryHistory()
    renderer.create(
      <Router location={history.location} navigator={history}>
        <Sidebar />
      </Router>
    )
    expect(screen.getByTestId('dashboard-link')).toHaveTextContent('Dashboard')
    expect(screen.getByTestId('graphiql-link')).toHaveTextContent('GraphiQL')
  })
})
