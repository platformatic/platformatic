import renderer from 'react-test-renderer'
import React from 'react'
import Navbar from './Navbar'

test('Navbar', () => {
  test('renders Navbar component', () => {
    renderer.create(<Navbar />)
    expect(screen.getByTestId('navbar-home-link')).toHaveTextContent(
      'Platformatic DB'
    )
  })
})
