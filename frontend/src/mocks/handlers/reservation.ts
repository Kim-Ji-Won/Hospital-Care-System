/** 02 예약 관리 목 핸들러 — docs/api/02-reservation.md 2-1 ~ 2-9 */
import { http, HttpResponse } from "msw";
import type { CreateReservationRequest, DayOff } from "@/lib/api/types";
import { now, today } from "@/lib/date";
import { db, nextId, save } from "../db";
import { apiError, requireRole, validationError } from "../http";
import { bookingDates, bookingSlots, departmentOf, freeSchedulesAt, hasSlotTime, isFreeSlot, scheduleOf, staffOf, toMyReservation, toStaffReservation } from "../logic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** 의사: 본인 일정의 예약, 간호사: 본인 진료과 의사의 예약 */
function canSeeReservation(staffId: number, scheduleId: number) {
  const viewer = staffOf(staffId);
  const doctor = staffOf(scheduleOf(scheduleId).doctor_id);
  return viewer.job_type === "의사" ? doctor.staff_id === viewer.staff_id : doctor.department_code === viewer.department_code;
}

export const reservationHandlers = [
  // 2-1 예약 가능한 날짜
  http.get("/api/booking/dates", ({ request }) => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const url = new URL(request.url);
    const code = url.searchParams.get("departmentCode") ?? "";
    const month = url.searchParams.get("month") ?? "";
    if (!code || !MONTH.test(month)) return validationError({ month: "진료과와 YYYY-MM 형식의 달을 보내세요." });
    if (!departmentOf(code)) return apiError(404, "NOT_FOUND", "없는 진료과코드입니다.");
    return HttpResponse.json(bookingDates(code, month, user.patientId!));
  }),

  // 2-2 예약 가능한 시간
  http.get("/api/booking/slots", ({ request }) => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const url = new URL(request.url);
    const code = url.searchParams.get("departmentCode") ?? "";
    const date = url.searchParams.get("date") ?? "";
    if (!code || !DATE.test(date)) return validationError({ date: "진료과와 날짜를 보내세요." });
    if (!departmentOf(code)) return apiError(404, "NOT_FOUND", "없는 진료과코드입니다.");
    return HttpResponse.json(bookingSlots(code, date, user.patientId!));
  }),

  // 2-3 예약하기: 그 시각에 빈 일정 중 무작위 배정
  http.post("/api/me/reservations", async ({ request }) => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const b = (await request.json()) as Partial<CreateReservationRequest>;
    if (!b.departmentCode || !b.appointmentAt || !DATETIME.test(b.appointmentAt)) return validationError({ appointmentAt: "진료과와 예약일시를 보내세요." });
    if (!departmentOf(b.departmentCode)) return apiError(404, "NOT_FOUND", "없는 진료과코드입니다.");
    if (b.symptomNote && b.symptomNote.length > 500) return validationError({ symptomNote: "500자 이내로 입력하세요." });
    if (b.appointmentAt <= now() || !hasSlotTime(b.departmentCode, b.appointmentAt)) {
      return validationError({ appointmentAt: "예약할 수 있는 시각이 아닙니다." });
    }
    const d = db();
    if (d.reservations.some((r) => r.patient_id === user.patientId && r.appointment_at === b.appointmentAt && r.status !== "취소")) {
      return apiError(409, "PATIENT_TIME_CONFLICT", "같은 시각에 다른 예약이 있습니다.");
    }
    const [schedule] = freeSchedulesAt(b.departmentCode, b.appointmentAt);
    if (!schedule) return apiError(409, "SLOT_TAKEN", "그 시각의 빈 일정이 모두 찼습니다.");
    const row = {
      reservation_id: nextId(d.reservations, "reservation_id"),
      patient_id: user.patientId!,
      schedule_id: schedule.schedule_id,
      appointment_at: b.appointmentAt,
      status: "예약" as const,
      created_at: now(),
      symptom_note: b.symptomNote?.trim() || null,
    };
    d.reservations.push(row);
    save();
    return HttpResponse.json(toMyReservation(row), { status: 201 });
  }),

  // 2-8 예약 시간 변경: 같은 진료과 안에서, 새 시각의 빈 일정으로 다시 배정 (실패하면 아무것도 안 바뀜)
  http.patch("/api/me/reservations/:reservationId", async ({ params, request }) => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const d = db();
    const r = d.reservations.find((x) => x.reservation_id === Number(params.reservationId));
    if (!r) return apiError(404, "NOT_FOUND", "없는 예약번호입니다.");
    if (r.patient_id !== user.patientId) return apiError(403, "FORBIDDEN", "본인 예약만 바꿀 수 있습니다.");
    if (r.status !== "예약") return apiError(409, "INVALID_STATUS", "'예약' 상태만 바꿀 수 있습니다.");
    const { appointmentAt } = (await request.json()) as { appointmentAt?: string };
    if (!appointmentAt || !DATETIME.test(appointmentAt)) return validationError({ appointmentAt: "예약일시를 보내세요." });
    if (appointmentAt === r.appointment_at) return validationError({ appointmentAt: "지금 예약과 같은 시각입니다." });
    const deptCode = staffOf(scheduleOf(r.schedule_id).doctor_id).department_code!;
    if (appointmentAt <= now() || !hasSlotTime(deptCode, appointmentAt)) return validationError({ appointmentAt: "예약할 수 있는 시각이 아닙니다." });
    if (d.reservations.some((x) => x.patient_id === user.patientId && x.appointment_at === appointmentAt && x.status !== "취소" && x.reservation_id !== r.reservation_id)) {
      return apiError(409, "PATIENT_TIME_CONFLICT", "같은 시각에 다른 예약이 있습니다.");
    }
    const [date, time] = appointmentAt.split("T");
    const [schedule] = freeSchedulesAt(deptCode, appointmentAt).filter((s) => isFreeSlot(s, date, time, r.reservation_id));
    if (!schedule) return apiError(409, "SLOT_TAKEN", "그 시각의 빈 일정이 모두 찼습니다.");
    r.schedule_id = schedule.schedule_id;
    r.appointment_at = appointmentAt;
    save();
    return HttpResponse.json(toMyReservation(r));
  }),

  // 2-9 예약 취소: 행은 지우지 않고 '취소'로 (마감 시각 없음)
  http.post("/api/me/reservations/:reservationId/cancel", ({ params }) => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const r = db().reservations.find((x) => x.reservation_id === Number(params.reservationId));
    if (!r) return apiError(404, "NOT_FOUND", "없는 예약번호입니다.");
    if (r.patient_id !== user.patientId) return apiError(403, "FORBIDDEN", "본인 예약만 취소할 수 있습니다.");
    if (r.status !== "예약") return apiError(409, "INVALID_STATUS", "'예약' 상태만 취소할 수 있습니다.");
    r.status = "취소";
    save();
    return HttpResponse.json(toMyReservation(r));
  }),

  // 2-4 내 예약 목록 (예약일시 내림차순)
  http.get("/api/me/reservations", () => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const list = db()
      .reservations.filter((r) => r.patient_id === user.patientId)
      .sort((a, b) => b.appointment_at.localeCompare(a.appointment_at))
      .map(toMyReservation);
    return HttpResponse.json(list);
  }),

  // 2-5 오늘 진료 목록
  http.get("/api/reservations", ({ request }) => {
    const { user, deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const date = new URL(request.url).searchParams.get("date") || today();
    if (!DATE.test(date)) return validationError({ date: "YYYY-MM-DD 형식으로 보내세요." });
    const d = db();
    const reservations = d.reservations
      .filter((r) => r.appointment_at.startsWith(date) && r.status !== "취소" && canSeeReservation(user.staffId!, r.schedule_id))
      .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at))
      .map(toStaffReservation);
    const dayOffs: DayOff[] = d.dayOffs
      .filter((o) => o.off_date === date && canSeeReservation(user.staffId!, o.schedule_id))
      .map((o) => {
        const s = scheduleOf(o.schedule_id);
        return {
          dayOffId: o.day_off_id,
          scheduleId: o.schedule_id,
          offDate: o.off_date,
          reason: o.reason,
          doctorId: s.doctor_id,
          doctorName: staffOf(s.doctor_id).name,
          dayOfWeek: s.day_of_week,
          startTime: s.start_time,
          endTime: s.end_time,
        };
      });
    return HttpResponse.json({ date, dayOffs, reservations });
  }),

  // 2-6 예약 한 건
  http.get("/api/reservations/:reservationId", ({ params }) => {
    const { deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const r = db().reservations.find((x) => x.reservation_id === Number(params.reservationId));
    if (!r) return apiError(404, "NOT_FOUND", "없는 예약번호입니다.");
    return HttpResponse.json(toStaffReservation(r));
  }),

  // 2-7 노쇼 처리
  http.post("/api/reservations/:reservationId/no-show", ({ params }) => {
    const { user, deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const r = db().reservations.find((x) => x.reservation_id === Number(params.reservationId));
    if (!r) return apiError(404, "NOT_FOUND", "없는 예약번호입니다.");
    if (!canSeeReservation(user.staffId!, r.schedule_id)) return apiError(403, "FORBIDDEN", "본인 일정(간호사는 본인 진료과)의 예약만 처리할 수 있습니다.");
    if (r.status !== "예약") return apiError(409, "INVALID_STATUS", "상태가 '예약'인 예약만 노쇼로 바꿀 수 있습니다.");
    r.status = "노쇼";
    save();
    return HttpResponse.json(toStaffReservation(r));
  }),
];
