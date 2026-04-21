import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

interface DropdownItem {
  label: string;
  to: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: DropdownItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Capital Humano',
    items: [
      { label: 'Directorio', to: '/capital-humano', icon: '👥' },
      { label: 'Importar Empleados', to: '/capital-humano/importar', icon: '📥' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Incidencias', to: '/operaciones/incidencias', icon: '📋' },
      { label: 'Préstamos', to: '/operaciones/prestamos', icon: '💳' },
    ],
  },
  {
    label: 'Nómina',
    items: [
      { label: 'Calcular Nómina', to: '/nomina/calcular', icon: '🧮' },
      { label: 'Banco Horas Extra', to: '/nomina/horas-extra', icon: '⏱️' },
      { label: 'Historia', to: '/nomina/historia', icon: '📜' },
    ],
  },
];

const Navbar: React.FC = () => {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenSection(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setOpenSection(null);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    navigate('/login');
  };

  const toggleSection = (label: string) => {
    setOpenSection(prev => (prev === label ? null : label));
  };

  const isSectionActive = (section: NavSection) =>
    section.items.some(item => location.pathname.startsWith(item.to));

  return (
    <nav className="navbar" ref={navRef}>
      {/* Brand */}
      <NavLink to="/" className="navbar-brand" onClick={() => setOpenSection(null)}>
        <div className="navbar-brand-icon">⚡</div>
        <span className="navbar-brand-text">Nómina 360°</span>
      </NavLink>

      {/* Nav Items */}
      <ul className="navbar-nav">
        {/* Dashboard */}
        <li className="nav-item">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Dashboard
          </NavLink>
        </li>

        {/* Dropdown Sections */}
        {NAV_SECTIONS.map(section => (
          <li
            key={section.label}
            className={`nav-item${openSection === section.label ? ' open' : ''}`}
          >
            <button
              className={`nav-link${isSectionActive(section) ? ' dropdown-parent-active' : ''}`}
              onClick={() => toggleSection(section.label)}
              aria-expanded={openSection === section.label}
            >
              {section.label}
              <svg
                className="nav-chevron"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <div className="dropdown-menu" role="menu">
              {section.items.map((item, idx) => (
                <React.Fragment key={item.to}>
                  {idx > 0 && idx === section.items.length - 1 && section.label === 'Nómina' && (
                    <div className="dropdown-divider" />
                  )}
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `dropdown-item${isActive ? ' active' : ''}`
                    }
                    end={item.to === '/capital-humano'}
                    role="menuitem"
                  >
                    <span className="dropdown-item-icon">{item.icon}</span>
                    {item.label}
                  </NavLink>
                </React.Fragment>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {/* Right side */}
      <div className="navbar-right">
        <button className="nav-logout-btn" onClick={handleLogout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Salir
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
