import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BOOTHS,
  applyStatusChange,
  createReservationRecord,
  getEffectiveCapacity,
  getOpenSeats,
  storage,
  syncBoothSlotCounts,
  validateParticipantBooking,
  type Booth,
  type BoothSlot,
  type Reservation,
} from '@bgf/shared';

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
  getBooth: (boothId: string) => Booth | undefined;
  getSlot: (boothId: string, slotId: string) => BoothSlot | undefined;
  getMyReservations: (phone: string) => Reservation[];
  /** 데모: 현장코드 미설정 부스에서 참가자가 입력한 코드로 진행 */
  setAccessCode: (boothId: string, code: string) => void;
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

  useEffect(() => {
    storage.saveBooths(booths);
  }, [booths]);

  useEffect(() => {
    storage.saveReservations(reservations);
  }, [reservations]);

  const getBooth = useCallback(
    (boothId: string) => booths.find((booth) => booth.id === boothId),
    [booths],
  );

  const getSlot = useCallback(
    (boothId: string, slotId: string) =>
      getBooth(boothId)?.slots.find((slot) => slot.id === slotId),
    [getBooth],
  );

  const getMyReservations = useCallback(
    (phone: string) => {
      const digits = phone.replace(/\D/g, '');
      return reservations.filter((item) => item.phone === digits);
    },
    [reservations],
  );

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

  const cancelReservation = useCallback(
    (reservationId: string, actorId: string) => {
      const current = reservations.find((item) => item.id === reservationId);
      if (!current) {
        return { ok: false as const, message: '예약을 찾을 수 없습니다.' };
      }

      const result = applyStatusChange(current, 'CANCELLED', actorId);
      if (!result.ok) return result;

      const next = reservations.map((item) =>
        item.id === current.id ? result.reservation : item,
      );
      setReservations(next);
      refreshBoothCounts(next);
      return { ok: true as const };
    },
    [reservations, refreshBoothCounts],
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
      getBooth,
      getSlot,
      getMyReservations,
      setAccessCode,
      createReservation,
      cancelReservation,
      getOpenSeatCount,
    }),
    [
      booths,
      reservations,
      getBooth,
      getSlot,
      getMyReservations,
      setAccessCode,
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
