import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BOOTHS } from '../data/boothData';
import type {
  AuthSession,
  Booth,
  BoothSlot,
  OperationLog,
  Reservation,
  ReservationStatus,
} from '../types';
import { verifyOperatorPin } from '../services/authService';
import {
  applyStatusChange,
  createReservationRecord,
  getOpenSeats,
  syncBoothSlotCounts,
  validateParticipantBooking,
} from '../services/reservationService';
import { storage } from '../services/storageService';
import { getEffectiveCapacity } from '../utils/capacity';

function cloneBooths(source: Booth[]): Booth[] {
  return source.map((booth) => ({
    ...booth,
    slots: booth.slots.map((slot) => ({ ...slot })),
  }));
}

function mergeBoothDefaults(saved: Booth[] | null): Booth[] {
  const base = cloneBooths(BOOTHS);
  if (!saved) return base;

  return base.map((booth) => {
    const match = saved.find((item) => item.id === booth.id);
    if (!match) return booth;
    return {
      ...booth,
      accessCode: match.accessCode,
      accessCodeConfigured: match.accessCodeConfigured,
      capacity: match.capacity,
      waitlistCapacity: match.waitlistCapacity,
      status: match.status,
      slots: booth.slots.map((slot) => {
        const savedSlot = match.slots.find((item) => item.id === slot.id);
        return savedSlot
          ? {
              ...slot,
              bookingOpen: savedSlot.bookingOpen,
              confirmedCount: savedSlot.confirmedCount,
              waitlistCount: savedSlot.waitlistCount,
            }
          : slot;
      }),
    };
  });
}

interface AppStoreValue {
  booths: Booth[];
  reservations: Reservation[];
  logs: OperationLog[];
  session: AuthSession | null;
  getBooth: (boothId: string) => Booth | undefined;
  getSlot: (boothId: string, slotId: string) => BoothSlot | undefined;
  getReservationsForBooth: (boothId: string) => Reservation[];
  getReservationsForSlot: (boothId: string, slotId: string) => Reservation[];
  getMyReservations: (phone: string) => Reservation[];
  loginOperator: (
    loginId: string,
    pin: string,
  ) =>
    | { ok: true; session: AuthSession }
    | { ok: false; message: string };
  logout: () => void;
  setAccessCode: (boothId: string, code: string) => void;
  setCapacity: (
    boothId: string,
    capacity: number | null,
    waitlistCapacity: number | null,
  ) => void;
  setSlotBookingOpen: (boothId: string, slotId: string, open: boolean) => void;
  createReservation: (input: {
    boothId: string;
    slotId: string;
    participantName: string;
    phone: string;
    gradeOrAge: string;
  }) =>
    | { ok: true; reservation: Reservation }
    | { ok: false; message: string };
  cancelReservation: (
    reservationId: string,
    actorId: string,
  ) => { ok: true } | { ok: false; message: string };
  changeReservationStatus: (input: {
    reservationId: string;
    nextStatus: ReservationStatus;
    operatorId: string;
    operatorName: string;
    actionLabel: string;
  }) => { ok: true; reservation: Reservation } | { ok: false; message: string };
  callNextWaitlist: (input: {
    boothId: string;
    slotId: string;
    operatorId: string;
    operatorName: string;
  }) => { ok: true; reservation: Reservation } | { ok: false; message: string };
  getOpenSeatCount: (boothId: string, slotId: string) => number | null;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [booths, setBooths] = useState<Booth[]>(() =>
    mergeBoothDefaults(storage.loadBooths()),
  );
  const [reservations, setReservations] = useState<Reservation[]>(
    () => storage.loadReservations() ?? [],
  );
  const [logs, setLogs] = useState<OperationLog[]>(
    () => storage.loadLogs() ?? [],
  );
  const [session, setSession] = useState<AuthSession | null>(() =>
    storage.loadSession(),
  );

  useEffect(() => {
    storage.saveBooths(booths);
  }, [booths]);

  useEffect(() => {
    storage.saveReservations(reservations);
  }, [reservations]);

  useEffect(() => {
    storage.saveLogs(logs);
  }, [logs]);

  useEffect(() => {
    storage.saveSession(session);
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

  const getMyReservations = useCallback(
    (phone: string) => {
      const digits = phone.replace(/\D/g, '');
      return reservations.filter((item) => item.phone === digits);
    },
    [reservations],
  );

  const loginOperator = useCallback((loginId: string, pin: string) => {
    const result = verifyOperatorPin(loginId, pin);
    if (!result.ok) return result;
    setSession(result.session);
    return { ok: true as const, session: result.session };
  }, []);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const setAccessCode = useCallback((boothId: string, code: string) => {
    setBooths((prev) =>
      prev.map((booth) =>
        booth.id === boothId
          ? {
              ...booth,
              accessCode: code,
              accessCodeConfigured: code.trim().length > 0,
            }
          : booth,
      ),
    );
  }, []);

  const setCapacity = useCallback(
    (
      boothId: string,
      capacity: number | null,
      waitlistCapacity: number | null,
    ) => {
      setBooths((prev) =>
        prev.map((booth) =>
          booth.id === boothId
            ? {
                ...booth,
                capacity,
                waitlistCapacity,
                status:
                  capacity === null || waitlistCapacity === null
                    ? 'CAPACITY_PENDING'
                    : 'BOOKING_OPEN',
              }
            : booth,
        ),
      );
    },
    [],
  );

  const setSlotBookingOpen = useCallback(
    (boothId: string, slotId: string, open: boolean) => {
      setBooths((prev) =>
        prev.map((booth) =>
          booth.id === boothId
            ? {
                ...booth,
                slots: booth.slots.map((slot) =>
                  slot.id === slotId ? { ...slot, bookingOpen: open } : slot,
                ),
              }
            : booth,
        ),
      );
    },
    [],
  );

  const refreshBoothCounts = useCallback((nextReservations: Reservation[]) => {
    setBooths((prev) =>
      prev.map((booth) => syncBoothSlotCounts(booth, nextReservations)),
    );
  }, []);

  const createReservation = useCallback(
    (input: {
      boothId: string;
      slotId: string;
      participantName: string;
      phone: string;
      gradeOrAge: string;
    }) => {
      const booth = booths.find((item) => item.id === input.boothId);
      if (!booth) {
        return { ok: false as const, message: '부스를 찾을 수 없습니다.' };
      }

      const validation = validateParticipantBooking(
        booth,
        input.slotId,
        input.phone,
        reservations,
      );
      if (!validation.ok) return validation;

      const existingCodes = new Set(
        reservations.map((item) => item.reservationCode),
      );
      const waitlistCount = reservations.filter(
        (item) =>
          item.boothId === input.boothId &&
          item.slotId === input.slotId &&
          (item.status === 'WAITLIST' || item.status === 'WAITLIST_CALLED'),
      ).length;

      const reservation = createReservationRecord({
        booth,
        slotId: input.slotId,
        participantName: input.participantName,
        phone: input.phone,
        gradeOrAge: input.gradeOrAge,
        isWaitlist: validation.isWaitlist,
        existingCodes,
        existingWaitlistCount: waitlistCount,
      });

      const next = [...reservations, reservation];
      setReservations(next);
      refreshBoothCounts(next);

      const effective = getEffectiveCapacity(booth);
      if (effective.isConfigured && !effective.isDemo) {
        setBooths((prev) =>
          prev.map((item) =>
            item.id === booth.id
              ? { ...syncBoothSlotCounts(item, next), status: 'BOOKING_OPEN' }
              : item,
          ),
        );
      }

      return { ok: true as const, reservation };
    },
    [booths, reservations, refreshBoothCounts],
  );

  const appendLog = useCallback(
    (log: Omit<OperationLog, 'id' | 'createdAt'>) => {
      const entry: OperationLog = {
        ...log,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setLogs((prev) => [entry, ...prev].slice(0, 500));
    },
    [],
  );

  const changeReservationStatus = useCallback(
    (input: {
      reservationId: string;
      nextStatus: ReservationStatus;
      operatorId: string;
      operatorName: string;
      actionLabel: string;
    }) => {
      const current = reservations.find((item) => item.id === input.reservationId);
      if (!current) {
        return { ok: false as const, message: '예약을 찾을 수 없습니다.' };
      }

      const result = applyStatusChange(
        current,
        input.nextStatus,
        input.operatorId,
      );
      if (!result.ok) return result;

      const next = reservations.map((item) =>
        item.id === current.id ? result.reservation : item,
      );
      setReservations(next);
      refreshBoothCounts(next);
      appendLog({
        reservationId: current.id,
        boothId: current.boothId,
        slotId: current.slotId,
        action: input.actionLabel,
        previousStatus: current.status,
        newStatus: input.nextStatus,
        operatorId: input.operatorId,
        operatorName: input.operatorName,
        participantName: current.participantName,
      });

      return { ok: true as const, reservation: result.reservation };
    },
    [reservations, refreshBoothCounts, appendLog],
  );

  const cancelReservation = useCallback(
    (reservationId: string, actorId: string) => {
      const result = changeReservationStatus({
        reservationId,
        nextStatus: 'CANCELLED',
        operatorId: actorId,
        operatorName: actorId === 'participant' ? '참가자' : actorId,
        actionLabel: '예약 취소',
      });
      if (!result.ok) {
        return { ok: false as const, message: result.message };
      }
      return { ok: true as const };
    },
    [changeReservationStatus],
  );

  const callNextWaitlist = useCallback(
    (input: {
      boothId: string;
      slotId: string;
      operatorId: string;
      operatorName: string;
    }) => {
      const candidates = reservations
        .filter(
          (item) =>
            item.boothId === input.boothId &&
            item.slotId === input.slotId &&
            item.status === 'WAITLIST',
        )
        .sort((a, b) => (a.waitlistOrder ?? 0) - (b.waitlistOrder ?? 0));

      const target = candidates[0];
      if (!target) {
        return { ok: false as const, message: '호출할 예비 참가자가 없습니다.' };
      }

      return changeReservationStatus({
        reservationId: target.id,
        nextStatus: 'WAITLIST_CALLED',
        operatorId: input.operatorId,
        operatorName: input.operatorName,
        actionLabel: `예비 ${target.waitlistOrder ?? 1}번 호출`,
      });
    },
    [reservations, changeReservationStatus],
  );

  const getOpenSeatCount = useCallback(
    (boothId: string, slotId: string) => {
      const booth = getBooth(boothId);
      if (!booth) return null;
      return getOpenSeats(booth, slotId, reservations);
    },
    [getBooth, reservations],
  );

  const value = useMemo(
    () => ({
      booths,
      reservations,
      logs,
      session,
      getBooth,
      getSlot,
      getReservationsForBooth,
      getReservationsForSlot,
      getMyReservations,
      loginOperator,
      logout,
      setAccessCode,
      setCapacity,
      setSlotBookingOpen,
      createReservation,
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
      getBooth,
      getSlot,
      getReservationsForBooth,
      getReservationsForSlot,
      getMyReservations,
      loginOperator,
      logout,
      setAccessCode,
      setCapacity,
      setSlotBookingOpen,
      createReservation,
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
