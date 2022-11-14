import renderer from 'react-test-renderer'
import React from 'react'
import Header from './Header'

test('Header', () => {
  test('renders Header component', () => {
    renderer.create(<Header />)
    expect(screen.getByTestId('header-home-link')).toHaveTextContent(
      'Platformatic DB'
    )
  })
})
