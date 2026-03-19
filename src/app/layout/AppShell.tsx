import { NavLink, Outlet } from 'react-router-dom';

import { APP_NAME } from '@/domain/models';
import { PwaPrompts } from '@/app/pwa/PwaPrompts';

const primaryLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/pantry', label: 'Dispensa' },
  { to: '/original-archive', label: 'Ricette' },
  { to: '/recipes', label: 'Ricette Personali' },
  { to: '/planner', label: 'Planner' },
  { to: '/shopping-list', label: 'Spesa' },
];

const secondaryLinks = [
  { to: '/history', label: 'Storico' },
  { to: '/ingredient-matrices', label: 'Ingredienti di Base' },
  { to: '/settings', label: 'Impostazioni' },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div>
          <p className="brand-kicker">Offline-first pantry PWA</p>
          <NavLink to="/" className="brand-link">
            {APP_NAME}
          </NavLink>
        </div>
        <nav className="secondary-nav" aria-label="Sezioni secondarie">
          {secondaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'pill-link active' : 'pill-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <nav className="primary-nav" aria-label="Navigazione principale">
        {primaryLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <main className="page-shell">
        <Outlet />
      </main>

      <PwaPrompts />
    </div>
  );
}
