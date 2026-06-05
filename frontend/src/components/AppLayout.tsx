import { NavLink, Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/" end className="app-brand">
            <span className="app-brand-mark" aria-hidden="true" />
            <span className="app-brand-text">
              <span className="app-brand-name">ISISlike</span>
              <span className="app-brand-tagline">Chemical Inventory & ELN</span>
            </span>
          </NavLink>
          <nav className="app-nav" aria-label="Main">
            <NavLink to="/" end>
              Structures
            </NavLink>
            <NavLink to="/databases">Databases</NavLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
