import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { canAccessBooth } from '../services/authService';

export function RequireStaff() {
  const { session } = useAppStore();
  if (!session || session.role === 'PARTICIPANT') {
    return <Navigate to="/staff/login" replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { session } = useAppStore();
  if (!session || session.role !== 'HEAD_ADMIN') {
    return <Navigate to="/admin/login" replace />;
  }
  return <Outlet />;
}

export function RequireBoothAccess() {
  const { boothId = '' } = useParams();
  const { session } = useAppStore();

  if (!session) {
    return <Navigate to="/staff/login" replace />;
  }

  if (!canAccessBooth(session, boothId)) {
    return (
      <div className="app-shell">
        <div className="glass-card notice warning">
          <strong>이 부스를 관리할 권한이 없습니다.</strong>
          <p>담당 부스만 열 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
