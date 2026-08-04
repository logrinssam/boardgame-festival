import { Link, NavLink, Outlet } from 'react-router-dom';
import { DEMO_MODE } from '@bgf/shared';
import type { ReactNode } from 'react';

interface ShellProps {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  footer?: ReactNode;
  badge?: string;
}

function Shell({
  children,
  title,
  subtitle,
  showBack = false,
  backTo = '/',
  footer,
  badge,
}: ShellProps) {
  return (
    <div className="app-shell">
      <div className="app-bg" aria-hidden="true" />
      <header className="app-header">
        {showBack ? (
          <Link to={backTo} className="back-link">
            ← 뒤로
          </Link>
        ) : (
          <div className="header-spacer" />
        )}
        <div className="header-brand">
          {badge ? <p className="brand-eyebrow">{badge}</p> : null}
          <h1 className="brand-title">제4회 창의융합 보드게임 대축제</h1>
        </div>
        {DEMO_MODE ? (
          <span className="demo-badge">개발용 데모 데이터</span>
        ) : (
          <div className="header-spacer" />
        )}
      </header>
      {(title || subtitle) && (
        <div className="page-heading">
          {title ? <h2>{title}</h2> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      )}
      <main className="app-main">{children ?? <Outlet />}</main>
      {footer ? <footer className="app-footer">{footer}</footer> : null}
    </div>
  );
}

export function ParticipantLayout() {
  return (
    <Shell
      footer={
        <nav className="bottom-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            홈
          </NavLink>
          <NavLink
            to="/guide"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            이용 안내
          </NavLink>
          <NavLink
            to="/my-reservations"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            내 예약
          </NavLink>
        </nav>
      }
    />
  );
}

export { Shell as AppShell };
