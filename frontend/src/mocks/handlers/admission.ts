/** 05 입·퇴원 관리 목 핸들러 — docs/api/05-admission.md 5-1 ~ 5-7 */
import { http, HttpResponse } from "msw";
import type { CreateAdmissionRequest, MyAdmission, PendingAdmission, Room } from "@/lib/api/types";
import { now, today } from "@/lib/date";
import { db, nextId, save } from "../db";
import { apiError, requireRole, validationError } from "../http";
import {
  createPayment,
  currentAdmissionOf,
  departmentOf,
  inpatientAmount,
  isPendingDecision,
  occupiedBeds,
  patientIdOfAdmission,
  patientSummary,
  roundsOf,
  staffOf,
  toAdmission,
  toAdmissionDetail,
  toPayment,
} from "../logic";

const STAFF = ["의사", "간호사"] as const;

export const admissionHandlers = [
  // 5-1 병실 현황 (병실번호 순)
  http.get("/api/rooms", ({ request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const available = new URL(request.url).searchParams.get("available") === "true";
    const list: Room[] = db()
      .rooms.map((r) => ({ roomNo: r.room_no, ward: r.ward, bedCount: r.bed_count, occupiedBeds: occupiedBeds(r.room_no), dailyFee: r.daily_fee }))
      .filter((r) => !available || r.occupiedBeds < r.bedCount)
      .sort((a, b) => a.roomNo - b.roomNo);
    return HttpResponse.json(list);
  }),

  // 5-2 입원 배정 대기 (입원 결정 시각 오름차순)
  http.get("/api/admissions/pending", () => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const list: PendingAdmission[] = db()
      .encounters.filter(isPendingDecision)
      .sort((a, b) => a.encounter_at.localeCompare(b.encounter_at))
      .map((e) => {
        const doctor = staffOf(e.doctor_id);
        return {
          decisionEncounterId: e.encounter_id,
          decidedAt: e.encounter_at,
          patient: patientSummary(e.patient_id),
          doctorId: doctor.staff_id,
          doctorName: doctor.name,
          departmentName: departmentOf(doctor.department_code)?.name ?? "",
        };
      });
    return HttpResponse.json(list);
  }),

  // 5-3 병실 배정 (입원 시작). 버튼을 누른 시각이 입원일시
  http.post("/api/admissions", async ({ request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const b = (await request.json()) as Partial<CreateAdmissionRequest>;
    const d = db();

    const f: Record<string, string> = {};
    if (!b.reason?.trim()) f.reason = "입원 사유를 입력하세요.";
    else if (b.reason.length > 500) f.reason = "500자 이내로 입력하세요.";
    if (b.expectedDischargeDate && b.expectedDischargeDate < today()) f.expectedDischargeDate = "퇴원 예정일은 오늘 이후여야 합니다.";
    const attending = d.staff.find((s) => s.staff_id === b.attendingId);
    if (attending && attending.job_type !== "의사") f.attendingId = "주치의는 의사만 맡을 수 있습니다.";
    if (Object.keys(f).length > 0) return validationError(f);

    const encounter = d.encounters.find((e) => e.encounter_id === b.decisionEncounterId);
    const room = d.rooms.find((r) => r.room_no === b.roomNo);
    if (!encounter || !room || !attending) return apiError(404, "NOT_FOUND", "없는 진료·병실·의료진입니다.");
    if (!isPendingDecision(encounter)) return apiError(409, "INVALID_STATUS", "배정 대기인 진료가 아닙니다.");
    const current = currentAdmissionOf(encounter.patient_id);
    if (current) {
      return apiError(409, "ALREADY_ADMITTED", "이미 입원 중인 환자입니다.", {
        details: { admissionId: current.admission_id, roomNo: current.room_no, admittedAt: current.admitted_at },
      });
    }
    // 실제로는 병실 행을 FOR UPDATE로 잠근 뒤 셉니다
    if (occupiedBeds(room.room_no) >= room.bed_count) return apiError(409, "ROOM_FULL", "빈 병상이 없습니다.");

    const row = {
      admission_id: nextId(d.admissions, "admission_id"),
      decision_encounter_id: encounter.encounter_id,
      attending_id: attending.staff_id,
      room_no: room.room_no,
      admitted_at: now(),
      expected_discharge_date: b.expectedDischargeDate ?? null,
      discharged_at: null,
      reason: b.reason!.trim(),
    };
    d.admissions.push(row);
    save();
    return HttpResponse.json(toAdmission(row), { status: 201 });
  }),

  // 5-4 입원 목록 (입원일시 오름차순, 기본 퇴원 전만)
  http.get("/api/admissions", ({ request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const current = new URL(request.url).searchParams.get("current") !== "false";
    const list = db()
      .admissions.filter((a) => !current || !a.discharged_at)
      .sort((a, b) => a.admitted_at.localeCompare(b.admitted_at))
      .map(toAdmission);
    return HttpResponse.json(list);
  }),

  // 5-5 입원 한 건 (회진 목록과 건수)
  http.get("/api/admissions/:admissionId", ({ params }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const a = db().admissions.find((x) => x.admission_id === Number(params.admissionId));
    if (!a) return apiError(404, "NOT_FOUND", "없는 입원번호입니다.");
    return HttpResponse.json(toAdmissionDetail(a));
  }),

  // 5-6 퇴원 처리: 퇴원일시 기록 + 결정 진료에 입원 통합 청구 '미결제' (한 트랜잭션)
  http.post("/api/admissions/:admissionId/discharge", async ({ params, request }) => {
    const { deny } = requireRole(...STAFF);
    if (deny) return deny;
    const { dischargedAt } = (await request.json()) as { dischargedAt?: string };
    const a = db().admissions.find((x) => x.admission_id === Number(params.admissionId));
    if (!a) return apiError(404, "NOT_FOUND", "없는 입원번호입니다.");
    if (a.discharged_at) return apiError(409, "ALREADY_DISCHARGED", "이미 퇴원 처리된 입원입니다.");
    const lastRoundAt = roundsOf(a.admission_id)[0]?.encounter_at ?? null;
    if (!dischargedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dischargedAt)) return validationError({ dischargedAt: "퇴원 일시를 입력하세요." });
    const at = dischargedAt.length === 16 ? `${dischargedAt}:00` : dischargedAt;
    if (at < a.admitted_at || at > now() || (lastRoundAt && at < lastRoundAt)) {
      return apiError(400, "VALIDATION_FAILED", "퇴원 일시를 확인하세요.", {
        fields: [{ field: "dischargedAt", reason: "입원 일시와 마지막 회진 이후, 지금 이전이어야 합니다." }],
        details: { admittedAt: a.admitted_at, lastRoundAt },
      });
    }
    a.discharged_at = at;
    const payment = createPayment(a.decision_encounter_id, inpatientAmount(a, at));
    save();
    const p = toPayment(payment);
    return HttpResponse.json({ admission: toAdmission(a), payment: { paymentId: p.paymentId, encounterId: p.encounterId, amount: p.amount, status: p.status } });
  }),

  // 5-7 내 입원 내역 (입원일시 내림차순)
  http.get("/api/me/admissions", () => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const list: MyAdmission[] = db()
      .admissions.filter((a) => patientIdOfAdmission(a) === user.patientId)
      .sort((a, b) => b.admitted_at.localeCompare(a.admitted_at))
      .map((a) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { patient, ...rest } = toAdmission(a);
        return { ...rest, rounds: roundsOf(a.admission_id).map((e) => ({ encounterAt: e.encounter_at, doctorName: staffOf(e.doctor_id).name, finding: e.finding })) };
      });
    return HttpResponse.json(list);
  }),
];
