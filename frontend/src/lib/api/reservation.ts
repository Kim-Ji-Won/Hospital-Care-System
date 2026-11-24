/** 02 예약 관리 (배성진) — docs/api/02-reservation.md */
import { api } from "./client";
import type {
  BookingDate,
  BookingSlot,
  CreateDayOffRequest,
  CreateDayOffResponse,
  CreateReservationRequest,
  CreateScheduleRequest,
  DailyReservations,
  DayOff,
  DayOffImpact,
  MyReservation,
  Schedule,
  StaffReservation,
  UpdateScheduleRequest,
} from "./types";

export const reservationKeys = {
  all: ["reservation"] as const,
  dates: (departmentCode: string, month: string) => [...reservationKeys.all, "dates", departmentCode, month] as const,
  slots: (departmentCode: string, date: string) => [...reservationKeys.all, "slots", departmentCode, date] as const,
  mine: () => [...reservationKeys.all, "mine"] as const,
  daily: (date: string) => [...reservationKeys.all, "daily", date] as const,
  detail: (reservationId: number) => [...reservationKeys.all, "detail", reservationId] as const,
  schedules: (doctorId: number) => [...reservationKeys.all, "schedules", doctorId] as const,
  dayOffs: (doctorId: number) => [...reservationKeys.all, "dayOffs", doctorId] as const,
  impact: (date: string, scheduleIds: number[]) => [...reservationKeys.all, "impact", date, ...scheduleIds] as const,
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
  /** 2-8 예약 시간 변경 (같은 진료과, 담당 의사는 다시 배정) */
  change: (reservationId: number, appointmentAt: string) => api.patch<MyReservation>(`/api/me/reservations/${reservationId}`, { appointmentAt }),
  /** 2-9 예약 취소 */
  cancel: (reservationId: number) => api.post<MyReservation>(`/api/me/reservations/${reservationId}/cancel`),
  /** 2-10 진료일정 목록 (요일·시작시각 순) */
  schedules: (doctorId: number) => api.get<Schedule[]>("/api/schedules", { doctorId }),
  /** 2-11 진료일정 추가 */
  createSchedule: (body: CreateScheduleRequest) => api.post<Schedule>("/api/schedules", body),
  /** 2-12 진료일정 수정 (시작·종료·간격만) */
  updateSchedule: (scheduleId: number, body: UpdateScheduleRequest) => api.patch<Schedule>(`/api/schedules/${scheduleId}`, body),
  /** 2-13 진료일정 닫기 (예약이 한 번도 없을 때만) */
  closeSchedule: (scheduleId: number) => api.delete(`/api/schedules/${scheduleId}`),
  /** 2-14 휴진 목록 */
  dayOffs: (doctorId: number, from?: string, to?: string) => api.get<DayOff[]>("/api/day-offs", { doctorId, from, to }),
  /** 2-15 휴진 영향 미리 보기 (저장하지 않음) */
  dayOffImpact: (date: string, scheduleIds: number[]) => api.get<DayOffImpact>("/api/day-offs/impact", { date, scheduleId: scheduleIds }),
  /** 2-16 휴진 등록 (그날 예약 재배정·취소까지 한 트랜잭션) */
  createDayOff: (body: CreateDayOffRequest) => api.post<CreateDayOffResponse>("/api/day-offs", body),
  /** 2-17 휴진 취소 (앞으로의 휴진만) */
  cancelDayOff: (dayOffId: number) => api.delete(`/api/day-offs/${dayOffId}`),
};
