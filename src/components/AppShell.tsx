import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { DEMO_MODE } from '../config/demoConfig';

interface AppShellProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AppShell({
  title,
  subtitle,
  showBack = false,
  backTo = '/',
  children,
  footer,
}: AppShellProps) {
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
          <p className="brand-eyebrow">미래잇다 · 창의융합</p>
          <h1 className="brand-title">제4회 창의융합 보드게임 대축제</h1>
        </div>
        {DEMO_MODE ? (
          <span className="demo-badge" title="개발용 데모 정원이 적용됩니다">
            개발용 데모 데이터
          </span>
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

      <main className="app-main">{children}</main>
      {footer ? <footer className="app-footer">{footer}</footer> : null}
    </div>
  );
}
