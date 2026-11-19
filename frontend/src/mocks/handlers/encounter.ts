/** 03 진료 관리 목 핸들러 — docs/api/03-encounter.md 3-1, 3-2 */
import { http, HttpResponse } from "msw";
import type { CreateEncounterRequest } from "@/lib/api/types";
import { now } from "@/lib/date";
import { db, nextId, save } from "../db";
import { apiError, requireRole, validationError } from "../http";
import { createPayment, outpatientAmount, toEncounterDetail } from "../logic";

/** 3-1의 입력 검사. 문제 있는 칸 이름(prescriptions[0].items[1].dose 형식)과 이유를 돌려줌 */
function validate(b: Partial<CreateEncounterRequest>) {
  const d = db();
  const f: Record<string, string> = {};
  const isOutpatient = b.reservationId != null;
  if ((b.reservationId == null) === (b.admissionId == null)) f.reservationId = "예약번호와 입원번호 중 하나만 보내세요.";
  if (!b.finding?.trim()) f.finding = "소견을 입력하세요.";
  else if (b.finding.length > 2000) f.finding = "2,000자 이내로 입력하세요.";
  if (b.symptom && b.symptom.length > 2000) f.symptom = "2,000자 이내로 입력하세요.";
  if (isOutpatient && b.encounterAt) f.encounterAt = "외래는 진료일시를 보내지 않습니다.";
  if (!isOutpatient && b.admissionDecided) f.admissionDecided = "회진에서는 입원을 결정하지 않습니다.";

  const diagnoses = b.diagnoses ?? [];
  if (isOutpatient && diagnoses.length === 0) f.diagnoses = "진단을 1건 이상 추가하세요.";
  if (diagnoses.length > 0 && diagnoses.filter((x) => x.isPrimary).length !== 1) f.diagnoses = "주진단을 1건만 정하세요.";
  diagnoses.forEach((x, i) => {
    if (!d.diseases.some((y) => y.disease_code === x.diseaseCode)) f[`diagnoses[${i}].diseaseCode`] = "등록되지 않은 질병코드입니다.";
  });
  if (new Set(diagnoses.map((x) => x.diseaseCode)).size !== diagnoses.length) f.diagnoses = "같은 질병을 두 번 넣을 수 없습니다.";

  const prescriptions = b.prescriptions ?? [];
  if (new Set(prescriptions.map((p) => p.dispenseType)).size !== prescriptions.length) f.prescriptions = "처방구분마다 처방전은 1건까지입니다.";
  prescriptions.forEach((p, i) => {
    if (!isOutpatient && p.dispenseType !== "원내") f[`prescriptions[${i}].dispenseType`] = "회진은 원내 처방만 할 수 있습니다.";
    if (p.items.length === 0) f[`prescriptions[${i}].items`] = "약품을 1개 이상 추가하세요.";
    if (new Set(p.items.map((x) => x.drugCode)).size !== p.items.length) f[`prescriptions[${i}].items`] = "같은 약을 두 번 넣을 수 없습니다.";
    p.items.forEach((x, j) => {
      const at = `prescriptions[${i}].items[${j}]`;
      if (!d.drugs.some((y) => y.drug_code === x.drugCode)) f[`${at}.drugCode`] = "등록되지 않은 약품입니다.";
      if (!(x.dose > 0 && x.dose <= 9999.99)) f[`${at}.dose`] = "1회 투여량은 0보다 커야 합니다.";
      if (!(Number.isInteger(x.timesPerDay) && x.timesPerDay >= 1)) f[`${at}.timesPerDay`] = "1일 횟수는 1 이상이어야 합니다.";
      if (!(Number.isInteger(x.durationDays) && x.durationDays >= 1)) f[`${at}.durationDays`] = "투약일수는 1 이상이어야 합니다.";
      if (!x.instruction?.trim() || x.instruction.length > 100) f[`${at}.instruction`] = "용법을 100자 이내로 입력하세요.";
    });
  });

  const exams = b.exams ?? [];
  exams.forEach((x, i) => {
    if (!d.examItems.some((y) => y.exam_code === x.examCode)) f[`exams[${i}].examCode`] = "등록되지 않은 검사코드입니다.";
  });
  if (new Set(exams.map((x) => x.examCode)).size !== exams.length) f.exams = "같은 검사를 두 번 요청할 수 없습니다.";
  return f;
}

export const encounterHandlers = [
  // 3-1 진료 기록 저장 (외래만. 회진은 2순위에서)
  http.post("/api/encounters", async ({ request }) => {
    const { user, deny } = requireRole("의사");
    if (deny) return deny;
    const b = (await request.json()) as Partial<CreateEncounterRequest>;
    const fields = validate(b);
    if (Object.keys(fields).length > 0) return validationError(fields);

    const d = db();
    if (b.admissionId != null) return apiError(404, "NOT_FOUND", "입원(회진)은 목 서버에 아직 없습니다.");
    const reservation = d.reservations.find((r) => r.reservation_id === b.reservationId);
    if (!reservation) return apiError(404, "NOT_FOUND", "없는 예약번호입니다.");
    if (reservation.status !== "예약") return apiError(409, "INVALID_STATUS", "상태가 '예약'인 예약만 진료를 저장할 수 있습니다.");
    if (b.admissionDecided) {
      const current = d.admissions.find((a) => !a.discharged_at && d.encounters.find((e) => e.encounter_id === a.decision_encounter_id)?.patient_id === reservation.patient_id);
      if (current) return apiError(409, "ALREADY_ADMITTED", "이미 입원 중인 환자입니다.", { details: { admissionId: current.admission_id, roomNo: current.room_no } });
    }

    // 한 트랜잭션: 진료 → 진단 → 처방 → 검사 → 예약 '완료' → (입원 결정이 아니면) 결제 '미결제'
    const at = now();
    const encounterId = nextId(d.encounters, "encounter_id");
    d.encounters.push({
      encounter_id: encounterId,
      patient_id: reservation.patient_id,
      doctor_id: user.staffId!,
      reservation_id: reservation.reservation_id,
      admission_id: null,
      encounter_at: at,
      encounter_type: "외래",
      symptom: b.symptom?.trim() || null,
      finding: b.finding!.trim(),
    });
    for (const x of b.diagnoses ?? []) d.diagnoses.push({ encounter_id: encounterId, disease_code: x.diseaseCode, is_primary: x.isPrimary ? "Y" : "N" });
    for (const p of b.prescriptions ?? []) {
      const prescriptionId = nextId(d.prescriptions, "prescription_id");
      d.prescriptions.push({ prescription_id: prescriptionId, encounter_id: encounterId, prescribed_at: at, dispense_type: p.dispenseType });
      for (const x of p.items) {
        d.prescriptionItems.push({ prescription_id: prescriptionId, drug_code: x.drugCode, dose: x.dose, times_per_day: x.timesPerDay, duration_days: x.durationDays, instruction: x.instruction.trim() });
      }
    }
    for (const x of b.exams ?? []) {
      d.exams.push({ exam_id: nextId(d.exams, "exam_id"), encounter_id: encounterId, exam_code: x.examCode, reader_id: null, requested_at: at, performed_at: null, status: "요청", result_value: null, result_flag: null, reading_note: null });
    }
    reservation.status = "완료";
    const payment = b.admissionDecided ? null : createPayment(encounterId, outpatientAmount(encounterId));
    save();

    return HttpResponse.json(
      { encounterId, encounterType: "외래", encounterAt: at, reservationId: reservation.reservation_id, admissionId: null, admissionDecided: !!b.admissionDecided, paymentId: payment?.payment_id ?? null },
      { status: 201 },
    );
  }),

  // 3-2 내 진료 기록 ('완료' 검사만)
  http.get("/api/me/encounters", () => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const list = db()
      .encounters.filter((e) => e.patient_id === user.patientId)
      .sort((a, b) => b.encounter_at.localeCompare(a.encounter_at))
      .map((e) => toEncounterDetail(e, null, true));
    return HttpResponse.json(list);
  }),
];
