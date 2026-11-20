/** 02 예약 관리 중 진료일정·휴진 목 핸들러 — docs/api/02-reservation.md 2-10 ~ 2-17 */
import { http, HttpResponse } from "msw";
import type { CreateDayOffRequest, CreateScheduleRequest, DayOff, DayOffImpact, Schedule, UpdateScheduleRequest } from "@/lib/api/types";
import { dayOfWeek, now, today } from "@/lib/date";
import { db, nextId, save, type DayOffRow, type ScheduleRow } from "../db";
import { apiError, requireRole, validationError } from "../http";
import { isFreeSlot, patientSummary, slotTimes, staffOf } from "../logic";

const STAFF = ["의사", "간호사"] as const;
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const TIME = /^\d{2}:\d{2}(:00)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const sec = (t: string) => (t.length === 5 ? `${t}:00` : t);

function toSchedule(s: ScheduleRow): Schedule {
  const d = db();
  const mine = d.reservations.filter((r) => r.schedule_id === s.schedule_id);
  return {
    scheduleId: s.schedule_id,
    doctorId: s.doctor_id,
    doctorName: staffOf(s.doctor_id).name,
    dayOfWeek: s.day_of_week,
    startTime: s.start_time,
    endTime: s.end_time,
    slotMinutes: s.slot_minutes,
    reservationCount: mine.length,
    upcomingCount: mine.filter((r) => r.status === "예약" && r.appointment_at >= now()).length,
  };
}

export function toDayOff(o: DayOffRow): DayOff {
  const s = db().schedules.find((x) => x.schedule_id === o.schedule_id)!;
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
}

function isDoctor(id: unknown) {
  return db().staff.some((s) => s.staff_id === Number(id) && s.job_type === "의사");
}

/** 2-11·2-12 공통 검사. 겹치는 같은 의사·같은 요일 일정이 있으면 그 일정 */
function checkTimes(doctorId: number, day: string, start: string, end: string, slot: number, ignoreId?: number) {
  const f: Record<string, string> = {};
  if (!TIME.test(start)) f.startTime = "시작 시각을 HH:MM으로 보내세요.";
  if (!TIME.test(end)) f.endTime = "종료 시각을 HH:MM으로 보내세요.";
  if (!f.startTime && !f.endTime && sec(start) >= sec(end)) f.endTime = "종료 시각은 시작보다 늦어야 합니다.";
  if (!Number.isInteger(slot) || slot < 1 || slot > 240) f.slotMinutes = "예약 간격은 1~240분입니다.";
  if (Object.keys(f).length) return { fields: f };
  const overlap = db().schedules.find(
    (s) => s.doctor_id === doctorId && s.day_of_week === day && s.schedule_id !== ignoreId && sec(start) < s.end_time && s.start_time < sec(end),
  );
  return { overlap };
}

/**
 * 2-15·2-16: 그날 쉬는 일정의 '예약'을 같은 진료과·같은 요일·같은 시각의 빈 일정으로 옮기고, 없으면 취소.
 * 후보가 여럿이면 일정번호가 가장 작은 것(미리 보기와 실제 결과가 같도록). apply가 false면 계산만.
 */
function applyDayOff(date: string, scheduleIds: number[], apply: boolean): DayOffImpact {
  const d = db();
  const dept = staffOf(d.schedules.find((s) => s.schedule_id === scheduleIds[0])!.doctor_id).department_code;
  const affected = d.reservations
    .filter((r) => scheduleIds.includes(r.schedule_id) && r.status === "예약" && r.appointment_at.startsWith(date))
    .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));
  const taken = new Set<string>(); // 미리 보기에서 앞 예약이 차지한 칸
  const result: DayOffImpact = { date, reassigned: [], cancelled: [] };
  for (const r of affected) {
    const time = r.appointment_at.slice(11);
    const target = d.schedules
      .filter(
        (s) =>
          !scheduleIds.includes(s.schedule_id) &&
          s.day_of_week === dayOfWeek(date) &&
          staffOf(s.doctor_id).department_code === dept &&
          slotTimes(s).includes(time) &&
          isFreeSlot(s, date, time) &&
          !taken.has(`${s.schedule_id}${time}`),
      )
      .sort((a, b) => a.schedule_id - b.schedule_id)[0];
    if (target) {
      taken.add(`${target.schedule_id}${time}`);
      result.reassigned.push({ reservationId: r.reservation_id, appointmentAt: r.appointment_at, patient: patientSummary(r.patient_id), toDoctorId: target.doctor_id, toDoctorName: staffOf(target.doctor_id).name });
      if (apply) r.schedule_id = target.schedule_id;
    } else {
      result.cancelled.push({ reservationId: r.reservation_id, appointmentAt: r.appointment_at, patient: patientSummary(r.patient_id) });
      if (apply) r.status = "취소";
    }
  }
  return result;
}

/** 2-15·2-16 입력 검사: 오늘보다 뒤, 같은 의사·같은 요일 일정 */
function checkDayOff(date: string | null, ids: number[]) {
  const d = db();
  if (!date || !DATE.test(date) || date <= today()) return validationError({ offDate: "휴진일은 오늘보다 뒤여야 합니다." });
  if (ids.length === 0) return validationError({ scheduleIds: "쉴 일정을 고르세요." });
  const schedules = ids.map((id) => d.schedules.find((s) => s.schedule_id === id));
  if (schedules.some((s) => !s)) return apiError(404, "NOT_FOUND", "없는 일정번호입니다.");
  if (new Set(schedules.map((s) => s!.doctor_id)).size > 1) return validationError({ scheduleIds: "한 의사의 일정만 고르세요." });
  if (schedules.some((s) => s!.day_of_week !== dayOfWeek(date))) return validationError({ offDate: "휴진일의 요일이 일정 요일과 다릅니다." });
  return null;
}

export const scheduleHandlers = [
  // 2-10 진료일정 목록 (요일 월→일, 시작시각 순)
  http.get("/api/schedules", ({ request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const doctorId = new URL(request.url).searchParams.get("doctorId");
    if (!doctorId) return validationError({ doctorId: "의사를 고르세요." });
    if (!isDoctor(doctorId)) return apiError(404, "NOT_FOUND", "없는 의료진이거나 의사가 아닙니다.");
    const list = db()
      .schedules.filter((s) => s.doctor_id === Number(doctorId))
      .sort((a, b) => DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) || a.start_time.localeCompare(b.start_time))
      .map(toSchedule);
    return HttpResponse.json(list);
  }),

  // 2-11 진료일정 추가
  http.post("/api/schedules", async ({ request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const b = (await request.json()) as Partial<CreateScheduleRequest>;
    if (!isDoctor(b.doctorId)) return validationError({ doctorId: "의사만 진료일정을 가질 수 있습니다." });
    if (!b.dayOfWeek || !DAYS.includes(b.dayOfWeek)) return validationError({ dayOfWeek: "요일을 고르세요." });
    const { fields, overlap } = checkTimes(b.doctorId!, b.dayOfWeek, b.startTime ?? "", b.endTime ?? "", Number(b.slotMinutes));
    if (fields) return validationError(fields);
    if (overlap) return apiError(409, "SCHEDULE_OVERLAP", "같은 요일 일정과 시간이 겹칩니다.", { details: { scheduleId: overlap.schedule_id, startTime: overlap.start_time, endTime: overlap.end_time } });
    const d = db();
    const row: ScheduleRow = {
      schedule_id: nextId(d.schedules, "schedule_id"),
      doctor_id: b.doctorId!,
      day_of_week: b.dayOfWeek,
      start_time: sec(b.startTime!),
      end_time: sec(b.endTime!),
      slot_minutes: Number(b.slotMinutes),
    };
    d.schedules.push(row);
    save();
    return HttpResponse.json(toSchedule(row), { status: 201 });
  }),

  // 2-12 진료일정 수정: 시작·종료·간격만. 앞으로의 '예약'이 칸에서 벗어나면 막음
  http.patch("/api/schedules/:scheduleId", async ({ params, request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const d = db();
    const s = d.schedules.find((x) => x.schedule_id === Number(params.scheduleId));
    if (!s) return apiError(404, "NOT_FOUND", "없는 일정번호입니다.");
    const b = (await request.json()) as UpdateScheduleRequest & { dayOfWeek?: string; doctorId?: number };
    if (b.dayOfWeek !== undefined || b.doctorId !== undefined) return validationError({ dayOfWeek: "요일과 의사는 바꿀 수 없습니다. 새 일정을 만들고 이 일정은 닫으세요." });
    const next = { start: b.startTime ?? s.start_time, end: b.endTime ?? s.end_time, slot: b.slotMinutes ?? s.slot_minutes };
    const { fields, overlap } = checkTimes(s.doctor_id, s.day_of_week, next.start, next.end, Number(next.slot), s.schedule_id);
    if (fields) return validationError(fields);
    if (overlap) return apiError(409, "SCHEDULE_OVERLAP", "같은 요일 일정과 시간이 겹칩니다.", { details: { scheduleId: overlap.schedule_id, startTime: overlap.start_time, endTime: overlap.end_time } });
    const candidate: ScheduleRow = { ...s, start_time: sec(next.start), end_time: sec(next.end), slot_minutes: Number(next.slot) };
    const slots = slotTimes(candidate);
    const out = d.reservations.filter((r) => r.schedule_id === s.schedule_id && r.status === "예약" && r.appointment_at >= now() && !slots.includes(r.appointment_at.slice(11)));
    if (out.length) return apiError(409, "RESERVATIONS_OUT_OF_RANGE", "앞으로의 예약이 칸에서 벗어납니다.", { details: { count: out.length } });
    Object.assign(s, candidate);
    save();
    return HttpResponse.json(toSchedule(s));
  }),

  // 2-13 진료일정 닫기: 예약이 한 번도 없을 때만 (휴진 행을 먼저 지움)
  http.delete("/api/schedules/:scheduleId", ({ params }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const d = db();
    const id = Number(params.scheduleId);
    if (!d.schedules.some((x) => x.schedule_id === id)) return apiError(404, "NOT_FOUND", "없는 일정번호입니다.");
    const count = d.reservations.filter((r) => r.schedule_id === id).length;
    if (count) return apiError(409, "IN_USE", "예약이 걸린 일정은 닫을 수 없습니다.", { details: { count } });
    d.dayOffs = d.dayOffs.filter((o) => o.schedule_id !== id);
    d.schedules = d.schedules.filter((x) => x.schedule_id !== id);
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  // 2-14 휴진 목록 (휴진일·시작시각 순)
  http.get("/api/day-offs", ({ request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const q = new URL(request.url).searchParams;
    const doctorId = q.get("doctorId");
    if (!doctorId) return validationError({ doctorId: "의사를 고르세요." });
    if (!isDoctor(doctorId)) return apiError(404, "NOT_FOUND", "없는 의료진이거나 의사가 아닙니다.");
    const from = q.get("from");
    const to = q.get("to");
    const d = db();
    const list = d.dayOffs
      .filter((o) => d.schedules.find((s) => s.schedule_id === o.schedule_id)?.doctor_id === Number(doctorId))
      .filter((o) => (!from || o.off_date >= from) && (!to || o.off_date <= to))
      .map(toDayOff)
      .sort((a, b) => a.offDate.localeCompare(b.offDate) || a.startTime.localeCompare(b.startTime));
    return HttpResponse.json(list);
  }),

  // 2-15 휴진 영향 미리 보기 (저장하지 않음)
  http.get("/api/day-offs/impact", ({ request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const q = new URL(request.url).searchParams;
    const date = q.get("date");
    const ids = q.getAll("scheduleId").map(Number);
    const bad = checkDayOff(date, ids);
    if (bad) return bad;
    return HttpResponse.json(applyDayOff(date!, ids, false));
  }),

  // 2-16 휴진 등록 + 그날 예약 재배정·취소 (한 트랜잭션)
  http.post("/api/day-offs", async ({ request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const b = (await request.json()) as Partial<CreateDayOffRequest>;
    const ids = b.scheduleIds ?? [];
    const bad = checkDayOff(b.offDate ?? null, ids);
    if (bad) return bad;
    if (b.reason && b.reason.length > 200) return validationError({ reason: "사유는 200자 이내입니다." });
    const d = db();
    const dup = d.dayOffs.find((o) => ids.includes(o.schedule_id) && o.off_date === b.offDate);
    if (dup) return apiError(409, "DAY_OFF_EXISTS", "그날 이미 휴진이 있습니다.", { details: { scheduleId: dup.schedule_id, dayOffId: dup.day_off_id } });
    const rows = ids.map((scheduleId) => {
      const row: DayOffRow = { day_off_id: nextId(d.dayOffs, "day_off_id"), schedule_id: scheduleId, off_date: b.offDate!, reason: b.reason?.trim() || null };
      d.dayOffs.push(row);
      return row;
    });
    const impact = applyDayOff(b.offDate!, ids, true);
    save();
    return HttpResponse.json({ dayOffs: rows.map(toDayOff), reassigned: impact.reassigned, cancelled: impact.cancelled }, { status: 201 });
  }),

  // 2-17 휴진 취소: 앞으로의 휴진만. 이미 옮겨지거나 취소된 예약은 돌아오지 않음
  http.delete("/api/day-offs/:dayOffId", ({ params }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const d = db();
    const o = d.dayOffs.find((x) => x.day_off_id === Number(params.dayOffId));
    if (!o) return apiError(404, "NOT_FOUND", "없는 휴진번호입니다.");
    if (o.off_date <= today()) return apiError(409, "INVALID_STATUS", "오늘이거나 지난 휴진은 취소할 수 없습니다.");
    d.dayOffs = d.dayOffs.filter((x) => x.day_off_id !== o.day_off_id);
    save();
    return new HttpResponse(null, { status: 204 });
  }),
];
