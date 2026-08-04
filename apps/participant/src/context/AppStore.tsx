import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Booth, BoothSlot, Reservation } from '@bgf/shared';
import {
  cancelReservationRemote,
  createReservationRemote,
  fetchMyReservations,
  getOpenSeatCountFromBooth,
  subscribeBooths,
} from '@bgf/shared/firebase/reservations';

interface AppStoreValue {
  booths: Booth[];
  loading: boolean;
  getBooth: (boothId: string) => Booth | undefined;
  getSlot: (boothId: string, slotId: string) => BoothSlot | undefined;
  getMyReservations: (phone: string) => Promise<Reservation[]>;
  createReservation: (input: {
    boothId: string;
    slotId: string;
    participantName: string;
    phone: string;
    gradeOrAge: string;
    accessCode?: string;
  }) => Promise<
    | { ok: true; reservation: Reservation }
    | { ok: false; message: string }
  >;
  cancelReservation: (
    reservationId: string,
    phone: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  getOpenSeatCount: (boothId: string, slotId: string) => number | null;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeBooths(
      (next) => {
        setBooths(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  const getBooth = useCallback(
    (boothId: string) => booths.find((booth) => booth.id === boothId),
    [booths],
  );

  const getSlot = useCallback(
    (boothId: string, slotId: string) =>
      getBooth(boothId)?.slots.find((slot) => slot.id === slotId),
    [getBooth],
  );

  const getMyReservations = useCallback(async (phone: string) => {
    return fetchMyReservations(phone);
  }, []);

  const createReservation = useCallback(
    async (input: {
      boothId: string;
      slotId: string;
      participantName: string;
      phone: string;
      gradeOrAge: string;
      accessCode?: string;
    }) => createReservationRemote(input),
    [],
  );

  const cancelReservation = useCallback(
    async (reservationId: string, phone: string) =>
      cancelReservationRemote({ reservationId, phone }),
    [],
  );

  const getOpenSeatCount = useCallback(
    (boothId: string, slotId: string) => {
      const booth = getBooth(boothId);
      if (!booth) return null;
      return getOpenSeatCountFromBooth(booth, slotId);
    },
    [getBooth],
  );

  const value = useMemo(
    () => ({
      booths,
      loading,
      getBooth,
      getSlot,
      getMyReservations,
      createReservation,
      cancelReservation,
      getOpenSeatCount,
    }),
    [
      booths,
      loading,
      getBooth,
      getSlot,
      getMyReservations,
      createReservation,
      cancelReservation,
      getOpenSeatCount,
    ],
  );

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreValue {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used within AppStoreProvider');
  }
  return context;
}
