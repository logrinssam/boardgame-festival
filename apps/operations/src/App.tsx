import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppStoreProvider } from './context/AppStore';
import { AdminLayout, StaffLayout } from './layouts/AppLayouts';
import {
  RequireAdmin,
  RequireBoothAccess,
  RequireStaff,
} from './routes/Guards';
import { AdminBoothsPage } from './pages/admin/AdminBoothsPage';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminReservationsPage } from './pages/admin/AdminReservationsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminStaffPage } from './pages/admin/AdminStaffPage';
import { StaffBoothOpsPage } from './pages/staff/StaffBoothOpsPage';
import { StaffGroupPage } from './pages/staff/StaffGroupPage';
import { StaffHomePage } from './pages/staff/StaffHomePage';
import { StaffLoginPage } from './pages/staff/StaffLoginPage';

export default function App() {
  return (
    <AppStoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/" element={<Navigate to="/staff/login" replace />} />

          <Route path="/staff/login" element={<StaffLayout />}>
            <Route index element={<StaffLoginPage />} />
          </Route>

          <Route path="/staff" element={<StaffLayout />}>
            <Route element={<RequireStaff />}>
              <Route index element={<StaffHomePage />} />
              <Route
                path="board-game"
                element={<StaffGroupPage group="BOARD_GAME" />}
              />
              <Route
                path="creative-convergence"
                element={<StaffGroupPage group="CREATIVE_CONVERGENCE" />}
              />
              <Route path="booths/:boothId" element={<RequireBoothAccess />}>
                <Route index element={<StaffBoothOpsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/admin/login" element={<AdminLayout />}>
            <Route index element={<AdminLoginPage />} />
          </Route>

          <Route path="/admin" element={<AdminLayout />}>
            <Route element={<RequireAdmin />}>
              <Route index element={<AdminHomePage />} />
              <Route path="booths" element={<AdminBoothsPage />} />
              <Route path="reservations" element={<AdminReservationsPage />} />
              <Route path="staff" element={<AdminStaffPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>

          <Route
            path="/admin/booth/:boothId"
            element={<Navigate to="/admin/booths" replace />}
          />
          <Route path="*" element={<Navigate to="/staff/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStoreProvider>
  );
}
