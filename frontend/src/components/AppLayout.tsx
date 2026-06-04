import { NavLink, Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <h1>ISISlike — Chemical Inventory & ELN</h1>
            <p>Phase 2A: Dynamic databases with custom fields and compound records.</p>
          </div>
          <nav className="app-nav" aria-label="Main">
            <NavLink to="/" end>
              Structures
            </NavLink>
            <NavLink to="/databases">Databases</NavLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </>
  );
}
