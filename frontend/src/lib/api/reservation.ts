/** 02 예약 관리 (배성진) — docs/api/02-reservation.md */
import { api } from "./client";
import type { BookingDate, BookingSlot, CreateReservationRequest, DailyReservations, MyReservation, StaffReservation } from "./types";

export const reservationKeys = {
  all: ["reservation"] as const,
  dates: (departmentCode: string, month: string) => [...reservationKeys.all, "dates", departmentCode, month] as const,
  slots: (departmentCode: string, date: string) => [...reservationKeys.all, "slots", departmentCode, date] as const,
  mine: () => [...reservationKeys.all, "mine"] as const,
  daily: (date: string) => [...reservationKeys.all, "daily", date] as const,
  detail: (reservationId: number) => [...reservationKeys.all, "detail", reservationId] as const,
};

export const reservationApi = {
  /** 2-1 예약 가능한 날짜 */
  bookingDates: (departmentCode: string, month: string) => api.get<BookingDate[]>("/api/booking/dates", { departmentCode, month }),
  /** 2-2 예약 가능한 시간 */
  bookingSlots: (departmentCode: string, date: string) => api.get<BookingSlot[]>("/api/booking/slots", { departmentCode, date }),
  /** 2-3 예약하기 */
  create: (body: CreateReservationRequest) => api.post<MyReservation>("/api/me/reservations", body),
  /** 2-4 내 예약 목록 */
  mine: () => api.get<MyReservation[]>("/api/me/reservations"),
  /** 2-5 오늘 진료 목록 */
  daily: (date: string) => api.get<DailyReservations>("/api/reservations", { date }),
  /** 2-6 예약 한 건 */
  detail: (reservationId: number) => api.get<StaffReservation>(`/api/reservations/${reservationId}`),
  /** 2-7 노쇼 처리 */
  noShow: (reservationId: number) => api.post<StaffReservation>(`/api/reservations/${reservationId}/no-show`),
};
