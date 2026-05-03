import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  House, 
  Users, 
  IdentificationCard, 
  FileArrowDown, 
  Briefcase, 
  ClipboardText, 
  CreditCard, 
  Coins, 
  Calculator, 
  Timer, 
  ClockCounterClockwise,
  Lightning,
  CaretDown,
  SignOut
} from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthContext';
import './Navbar.css';

interface DropdownItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface NavSection {
  label: string;
  icon: React.ReactNode;
  items: DropdownItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Capital Humano',
    icon: <Users size={20} />,
    items: [
      { label: 'Directorio', to: '/capital-humano', icon: <IdentificationCard size={18} /> },
      { label: 'Importar Empleados', to: '/capital-humano/importar', icon: <FileArrowDown size={18} /> },
    ],
  },
  {
    label: 'Operaciones',
    icon: <Briefcase size={20} />,
    items: [
      { label: 'Incidencias', to: '/operaciones/incidencias', icon: <ClipboardText size={18} /> },
      { label: 'Préstamos', to: '/operaciones/prestamos', icon: <CreditCard size={18} /> },
    ],
  },
  {
    label: 'Nómina',
    icon: <Coins size={20} />,
    items: [
      { label: 'Calcular Nómina', to: '/nomina/calcular', icon: <Calculator size={18} /> },
      { label: 'Banco Horas Extra', to: '/nomina/horas-extra', icon: <Timer size={18} /> },
      { label: 'Historia', to: '/nomina/historia', icon: <ClockCounterClockwise size={18} /> },
    ],
  },
];

const Navbar: React.FC = () => {
  const { logout } = useAuth();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenSection(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setOpenSection(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSection = (label: string) => {
    setOpenSection(prev => (prev === label ? null : label));
  };

  const isSectionActive = (section: NavSection) =>
    section.items.some(item => location.pathname.startsWith(item.to));

  return (
    <nav className="navbar" ref={navRef}>
      <NavLink to="/" className="navbar-brand" onClick={() => setOpenSection(null)}>
        <div className="navbar-brand-icon">
          <Lightning size={24} weight="fill" />
        </div>
        <span className="navbar-brand-text">Nómina 360°</span>
      </NavLink>

      <ul className="navbar-nav">
        <li className="nav-item">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <House size={20} style={{ marginRight: '8px' }} />
            Dashboard
          </NavLink>
        </li>

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
              <span className="nav-link-icon-container" style={{ marginRight: '8px', display: 'flex' }}>
                {section.icon}
              </span>
              {section.label}
              <CaretDown size={14} weight="bold" className="nav-chevron" />
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

      <div className="navbar-right">
        <button className="nav-logout-btn" onClick={handleLogout}>
          <SignOut size={18} style={{ marginRight: '6px' }} />
          Salir
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
