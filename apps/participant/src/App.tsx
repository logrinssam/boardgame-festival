import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppStoreProvider } from './context/AppStore';
import { ParticipantLayout } from './layouts/AppLayouts';
import { AccessCodePage } from './pages/AccessCodePage';
import { BoothDetailPage } from './pages/BoothDetailPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { ConsentPage } from './pages/ConsentPage';
import { GuidePage } from './pages/GuidePage';
import { HomePage } from './pages/HomePage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { ParticipantFormPage } from './pages/ParticipantFormPage';
import { SlotSelectPage } from './pages/SlotSelectPage';

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppStoreProvider>
  );
}
