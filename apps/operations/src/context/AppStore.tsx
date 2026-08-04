import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthSession,
  Booth,
  BoothSlot,
  OperationLog,
  Reservation,
  ReservationStatus,
} from '@bgf/shared';
import {
  callNextWaitlistRemote,
  cancelReservationRemote,
  changeReservationStatusRemote,
  getOpenSeatCountFromBooth,
  subscribeAllReservations,
  subscribeBooths,
  subscribeOperationLogs,
  updateBoothSettingsRemote,
} from '@bgf/shared/firebase/reservations';
import { logoutOperator, verifyOperatorPin } from '../services/authService';

interface AppStoreValue {
  booths: Booth[];
  reservations: Reservation[];
  logs: OperationLog[];
  session: AuthSession | null;
  loading: boolean;
  getBooth: (boothId: string) => Booth | undefined;
  getSlot: (boothId: string, slotId: string) => BoothSlot | undefined;
  getReservationsForBooth: (boothId: string) => Reservation[];
  getReservationsForSlot: (boothId: string, slotId: string) => Reservation[];
  loginOperator: (
    loginId: string,
    pin: string,
  ) => Promise<
    | { ok: true; session: AuthSession }
    | { ok: false; message: string }
  >;
  logout: () => Promise<void>;
  setAccessCode: (boothId: string, code: string) => Promise<void>;
  setCapacity: (
    boothId: string,
    capacity: number | null,
    waitlistCapacity: number | null,
  ) => Promise<void>;
  setSlotBookingOpen: (
    boothId: string,
    slotId: string,
    open: boolean,
  ) => Promise<void>;
  cancelReservation: (
    reservationId: string,
    actorId: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  changeReservationStatus: (input: {
    reservationId: string;
    nextStatus: ReservationStatus;
    operatorId: string;
    operatorName: string;
    actionLabel: string;
  }) => Promise<
    { ok: true; reservation: Reservation } | { ok: false; message: string }
  >;
  callNextWaitlist: (input: {
    boothId: string;
    slotId: string;
    operatorId: string;
    operatorName: string;
  }) => Promise<
    { ok: true; reservation: Reservation } | { ok: false; message: string }
  >;
  getOpenSeatCount: (boothId: string, slotId: string) => number | null;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubBooths = subscribeBooths(
      (next) => {
        setBooths(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsubBooths;
  }, []);

  useEffect(() => {
    if (!session) {
      setReservations([]);
      setLogs([]);
      return;
    }
    const unsubReservations = subscribeAllReservations(setReservations);
    const unsubLogs = subscribeOperationLogs(setLogs);
    return () => {
      unsubReservations();
      unsubLogs();
    };
  }, [session]);

  const getBooth = useCallback(
    (boothId: string) => booths.find((booth) => booth.id === boothId),
    [booths],
  );

  const getSlot = useCallback(
    (boothId: string, slotId: string) =>
      getBooth(boothId)?.slots.find((slot) => slot.id === slotId),
    [getBooth],
  );

  const getReservationsForBooth = useCallback(
    (boothId: string) =>
      reservations.filter((item) => item.boothId === boothId),
    [reservations],
  );

  const getReservationsForSlot = useCallback(
    (boothId: string, slotId: string) =>
      reservations.filter(
        (item) => item.boothId === boothId && item.slotId === slotId,
      ),
    [reservations],
  );

  const loginOperator = useCallback(async (loginId: string, pin: string) => {
    const result = await verifyOperatorPin(loginId, pin);
    if (!result.ok) return result;
    setSession(result.session);
    return { ok: true as const, session: result.session };
  }, []);

  const logout = useCallback(async () => {
    await logoutOperator();
    setSession(null);
  }, []);

  const setAccessCode = useCallback(async (boothId: string, code: string) => {
    await updateBoothSettingsRemote({ boothId, accessCode: code });
  }, []);

  const setCapacity = useCallback(
    async (
      boothId: string,
      capacity: number | null,
      waitlistCapacity: number | null,
    ) => {
      await updateBoothSettingsRemote({ boothId, capacity, waitlistCapacity });
    },
    [],
  );

  const setSlotBookingOpen = useCallback(
    async (boothId: string, slotId: string, open: boolean) => {
      await updateBoothSettingsRemote({
        boothId,
        slotId,
        bookingOpen: open,
      });
    },
    [],
  );

  const changeReservationStatus = useCallback(
    async (input: {
      reservationId: string;
      nextStatus: ReservationStatus;
      operatorId: string;
      operatorName: string;
      actionLabel: string;
    }) =>
      changeReservationStatusRemote({
        reservationId: input.reservationId,
        nextStatus: input.nextStatus,
        actionLabel: input.actionLabel,
      }),
    [],
  );

  const cancelReservation = useCallback(async (reservationId: string) => {
    return cancelReservationRemote({ reservationId });
  }, []);

  const callNextWaitlist = useCallback(
    async (input: {
      boothId: string;
      slotId: string;
      operatorId: string;
      operatorName: string;
    }) =>
      callNextWaitlistRemote({
        boothId: input.boothId,
        slotId: input.slotId,
      }),
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
      reservations,
      logs,
      session,
      loading,
      getBooth,
      getSlot,
      getReservationsForBooth,
      getReservationsForSlot,
      loginOperator,
      logout,
      setAccessCode,
      setCapacity,
      setSlotBookingOpen,
      cancelReservation,
      changeReservationStatus,
      callNextWaitlist,
      getOpenSeatCount,
    }),
    [
      booths,
      reservations,
      logs,
      session,
      loading,
      getBooth,
      getSlot,
      getReservationsForBooth,
      getReservationsForSlot,
      loginOperator,
      logout,
      setAccessCode,
      setCapacity,
      setSlotBookingOpen,
      cancelReservation,
      changeReservationStatus,
      callNextWaitlist,
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
