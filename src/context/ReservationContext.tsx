import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BOOTHS } from '../data/boothData';
import type { Booth, BoothSlot, ReservationDraft } from '../types';
import { canBookSlot, getEffectiveCapacity } from '../utils/capacity';

interface ReservationContextValue {
  booths: Booth[];
  reservations: ReservationDraft[];
  getBooth: (boothId: string) => Booth | undefined;
  getSlot: (boothId: string, slotId: string) => BoothSlot | undefined;
  setAccessCode: (boothId: string, code: string) => void;
  setCapacity: (
    boothId: string,
    capacity: number | null,
    waitlistCapacity: number | null,
  ) => void;
  setSlotBookingOpen: (boothId: string, slotId: string, open: boolean) => void;
  createReservation: (
    draft: Omit<ReservationDraft, 'createdAt' | 'waitlistOrder' | 'isWaitlist'>,
  ) =>
    | { ok: true; reservation: ReservationDraft }
    | { ok: false; message: string };
}

const ReservationContext = createContext<ReservationContextValue | null>(null);

function cloneBooths(source: Booth[]): Booth[] {
  return source.map((booth) => ({
    ...booth,
    slots: booth.slots.map((slot) => ({ ...slot })),
  }));
}

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [booths, setBooths] = useState<Booth[]>(() => cloneBooths(BOOTHS));
  const [reservations, setReservations] = useState<ReservationDraft[]>([]);

  const getBooth = useCallback(
    (boothId: string) => booths.find((booth) => booth.id === boothId),
    [booths],
  );

  const getSlot = useCallback(
    (boothId: string, slotId: string) =>
      getBooth(boothId)?.slots.find((slot) => slot.id === slotId),
    [getBooth],
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

  const createReservation = useCallback(
    (
      draft: Omit<ReservationDraft, 'createdAt' | 'waitlistOrder' | 'isWaitlist'>,
    ) => {
      const booth = booths.find((item) => item.id === draft.boothId);
      const slot = booth?.slots.find((item) => item.id === draft.slotId);

      if (!booth || !slot) {
        return { ok: false as const, message: '부스 또는 회차 정보를 찾을 수 없습니다.' };
      }

      const bookable = canBookSlot(booth, slot);
      if (!bookable.allowed) {
        return {
          ok: false as const,
          message: bookable.reason ?? '지금은 예약할 수 없습니다.',
        };
      }

      const effective = getEffectiveCapacity(booth);
      const waitlistOrder = bookable.isWaitlist
        ? slot.waitlistCount + 1
        : null;

      const reservation: ReservationDraft = {
        ...draft,
        isWaitlist: bookable.isWaitlist,
        waitlistOrder,
        createdAt: new Date().toISOString(),
      };

      setBooths((prev) =>
        prev.map((item) => {
          if (item.id !== draft.boothId) return item;
          return {
            ...item,
            slots: item.slots.map((s) => {
              if (s.id !== draft.slotId) return s;
              if (bookable.isWaitlist) {
                return { ...s, waitlistCount: s.waitlistCount + 1 };
              }
              return { ...s, confirmedCount: s.confirmedCount + 1 };
            }),
            status:
              effective.isConfigured && !effective.isDemo
                ? 'BOOKING_OPEN'
                : item.status,
          };
        }),
      );

      setReservations((prev) => [...prev, reservation]);
      return { ok: true as const, reservation };
    },
    [booths],
  );

  const value = useMemo(
    () => ({
      booths,
      reservations,
      getBooth,
      getSlot,
      setAccessCode,
      setCapacity,
      setSlotBookingOpen,
      createReservation,
    }),
    [
      booths,
      reservations,
      getBooth,
      getSlot,
      setAccessCode,
      setCapacity,
      setSlotBookingOpen,
      createReservation,
    ],
  );

  return (
    <ReservationContext.Provider value={value}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservations(): ReservationContextValue {
  const context = useContext(ReservationContext);
  if (!context) {
    throw new Error('useReservations must be used within ReservationProvider');
  }
  return context;
}
