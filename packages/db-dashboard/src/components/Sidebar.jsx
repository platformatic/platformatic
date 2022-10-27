import { NavLink } from 'react-router-dom'
import './Sidebar.css'
export default function Sidebar () {
  return (
    <aside className='menu is-hidden-mobile'>
      <p className='menu-label'>General</p>
      <ul className='menu-list'>
        <li>
          <NavLink data-testid='dashboard-link' to='/dashboard'>Dashboard</NavLink>
        </li>
        <li>
          <NavLink data-testid='graphiql-link' to='/giql'>GraphiQL</NavLink>
        </li>
        <li>
          <NavLink data-testid='config-view-link' to='/config-view'>View Config</NavLink>
        </li>
        <li>
          <NavLink data-testid='swagger-view-link' to='/swagger-docs'>Entity API Docs</NavLink>
        </li>
        <li>
          <NavLink data-testid='swagger-plt-db-view-link' to='/swagger-plt-db-docs'>Platformatic DB Admin API Docs</NavLink>
        </li>
        <li>
          <NavLink data-testid='my-app-link' to='/my-app'>My App</NavLink>
        </li>
        <li>
          <NavLink data-testid='react-admin-link' to='/react-admin'>React Admin</NavLink>
        </li>
      </ul>
    </aside>
  )
}
