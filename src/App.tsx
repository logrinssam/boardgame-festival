import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppStoreProvider } from './context/AppStore';
import {
  AdminLayout,
  ParticipantLayout,
  StaffLayout,
} from './layouts/AppLayouts';
import {
  RequireAdmin,
  RequireBoothAccess,
  RequireStaff,
} from './routes/Guards';
import { AccessCodePage } from './pages/AccessCodePage';
import { AdminBoothsPage } from './pages/admin/AdminBoothsPage';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminReservationsPage } from './pages/admin/AdminReservationsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminStaffPage } from './pages/admin/AdminStaffPage';
import { BoothDetailPage } from './pages/BoothDetailPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { ConsentPage } from './pages/ConsentPage';
import { GuidePage } from './pages/GuidePage';
import { HomePage } from './pages/HomePage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { ParticipantFormPage } from './pages/ParticipantFormPage';
import { SlotSelectPage } from './pages/SlotSelectPage';
import { StaffBoothOpsPage } from './pages/staff/StaffBoothOpsPage';
import { StaffGroupPage } from './pages/staff/StaffGroupPage';
import { StaffHomePage } from './pages/staff/StaffHomePage';
import { StaffLoginPage } from './pages/staff/StaffLoginPage';

export default function App() {
  return (
    <AppStoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route element={<ParticipantLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/booths" element={<HomePage />} />
            <Route path="/booths/:boothId" element={<BoothDetailPage />} />
            <Route
              path="/booths/:boothId/access"
              element={<AccessCodePage />}
            />
            <Route
              path="/booths/:boothId/slots"
              element={<SlotSelectPage />}
            />
            <Route path="/booking/consent" element={<ConsentPage />} />
            <Route
              path="/booking/participant"
              element={<ParticipantFormPage />}
            />
            <Route path="/booking/result" element={<ConfirmPage />} />
            <Route path="/my-reservations" element={<MyReservationsPage />} />
            <Route path="/guide" element={<GuidePage />} />
          </Route>

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

          <Route path="/admin/booth/:boothId" element={<Navigate to="/admin/booths" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStoreProvider>
  );
}
