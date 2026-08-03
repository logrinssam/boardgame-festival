import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ReservationProvider } from './context/ReservationContext';
import { AccessCodePage } from './pages/AccessCodePage';
import { AdminBoothPage } from './pages/AdminBoothPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminStaffPage } from './pages/AdminStaffPage';
import { BoothDetailPage } from './pages/BoothDetailPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { ConsentPage } from './pages/ConsentPage';
import { GuidePage } from './pages/GuidePage';
import { HomePage } from './pages/HomePage';
import { ParticipantFormPage } from './pages/ParticipantFormPage';
import { SlotSelectPage } from './pages/SlotSelectPage';

export default function App() {
  return (
    <ReservationProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/booth/:boothId" element={<BoothDetailPage />} />
          <Route path="/booth/:boothId/access" element={<AccessCodePage />} />
          <Route path="/booth/:boothId/slots" element={<SlotSelectPage />} />
          <Route
            path="/booth/:boothId/slots/:slotId/consent"
            element={<ConsentPage />}
          />
          <Route
            path="/booth/:boothId/slots/:slotId/form"
            element={<ParticipantFormPage />}
          />
          <Route
            path="/booth/:boothId/slots/:slotId/confirm"
            element={<ConfirmPage />}
          />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/staff" element={<AdminStaffPage />} />
          <Route path="/admin/booth/:boothId" element={<AdminBoothPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ReservationProvider>
  );
}
