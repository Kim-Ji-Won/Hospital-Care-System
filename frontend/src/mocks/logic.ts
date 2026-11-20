/**
 * 목 서버의 업무 규칙과 조인. 실제로는 백엔드가 할 일이라, 명세(docs/api)의 규칙을 그대로 옮겼습니다.
 * 행(snake_case) → API 모양(camelCase) 변환도 여기서 합니다.
 */
import type {
  EncounterDetail,
  Exam,
  MyReservation,
  PatientSummary,
  Payment,
  StaffReservation,
} from "@/lib/api/types";
import { dayOfWeek, now, parse, toDate } from "@/lib/date";
import { db, type EncounterRow, type ExamRow, type PaymentRow, type ReservationRow, type ScheduleRow } from "./db";

/** README 고정값 */
export const CONSULTATION_FEE = 15000;

// ---------- 조인 ----------

export function patientSummary(patientId: number): PatientSummary {
  const p = db().patients.find((x) => x.patient_id === patientId)!;
  return { patientId: p.patient_id, name: p.name, birthDate: p.birth_date, gender: p.gender };
}

export function staffOf(staffId: number) {
  return db().staff.find((s) => s.staff_id === staffId)!;
}

export function departmentOf(code: string | null) {
  return db().departments.find((d) => d.department_code === code);
}

export function scheduleOf(scheduleId: number) {
  return db().schedules.find((s) => s.schedule_id === scheduleId)!;
}

/** 예약 → 진료일정 → 의료진 → 진료과 */
function reservationParts(r: ReservationRow) {
  const schedule = scheduleOf(r.schedule_id);
  const doctor = staffOf(schedule.doctor_id);
  const dept = departmentOf(doctor.department_code)!;
  const encounter = db().encounters.find((e) => e.reservation_id === r.reservation_id);
  return { schedule, doctor, dept, encounterId: encounter?.encounter_id ?? null };
}

export function toMyReservation(r: ReservationRow): MyReservation {
  const { doctor, dept, encounterId } = reservationParts(r);
  return {
    reservationId: r.reservation_id,
    appointmentAt: r.appointment_at,
    status: r.status,
    symptomNote: r.symptom_note,
    createdAt: r.created_at,
    departmentCode: dept.department_code,
    departmentName: dept.name,
    departmentLocation: dept.location,
    doctorId: doctor.staff_id,
    doctorName: doctor.name,
    encounterId,
  };
}

export function toStaffReservation(r: ReservationRow): StaffReservation {
  const { schedule, doctor, dept, encounterId } = reservationParts(r);
  return {
    reservationId: r.reservation_id,
    appointmentAt: r.appointment_at,
    status: r.status,
    symptomNote: r.symptom_note,
    patient: patientSummary(r.patient_id),
    scheduleId: schedule.schedule_id,
    doctorId: doctor.staff_id,
    doctorName: doctor.name,
    departmentCode: dept.department_code,
    departmentName: dept.name,
    encounterId,
  };
}

// ---------- 02 예약 슬롯 규칙 ----------

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;

/** 칸: 시작시각부터 예약간격마다, 종료시각 전까지 */
export function slotTimes(s: ScheduleRow) {
  const out: string[] = [];
  for (let m = toMinutes(s.start_time); m < toMinutes(s.end_time); m += s.slot_minutes) out.push(fromMinutes(m));
  return out;
}

export function departmentSchedules(departmentCode: string, date: string) {
  const d = db();
  const doctorIds = d.staff.filter((s) => s.job_type === "의사" && s.department_code === departmentCode).map((s) => s.staff_id);
  const dow = dayOfWeek(date);
  return d.schedules.filter((s) => doctorIds.includes(s.doctor_id) && s.day_of_week === dow);
}

/** 빈 칸: 그날 휴진이 없고, 그 일정·그 일시에 취소 아닌 예약이 없음 */
export function isFreeSlot(s: ScheduleRow, date: string, time: string, ignoreReservationId?: number) {
  const d = db();
  if (d.dayOffs.some((o) => o.schedule_id === s.schedule_id && o.off_date === date)) return false;
  const at = `${date}T${time}`;
  return !d.reservations.some(
    (r) => r.schedule_id === s.schedule_id && r.appointment_at === at && r.status !== "취소" && r.reservation_id !== ignoreReservationId,
  );
}

/** 2-2: 그날 그 진료과의 시간 칸 */
export function bookingSlots(departmentCode: string, date: string, patientId: number) {
  const schedules = departmentSchedules(departmentCode, date);
  const times = [...new Set(schedules.flatMap(slotTimes))].sort();
  const nowAt = now();
  const mineAt = new Set(db().reservations.filter((r) => r.patient_id === patientId && r.status !== "취소").map((r) => r.appointment_at));
  return times.map((time) => {
    const at = `${date}T${time}`;
    const open = at > nowAt && schedules.some((s) => slotTimes(s).includes(time) && isFreeSlot(s, date, time));
    return { time, available: open && !mineAt.has(at), mine: mineAt.has(at) };
  });
}

/** 2-1: 한 달의 날짜별 예약 가능 여부 */
export function bookingDates(departmentCode: string, month: string, patientId: number) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const date = toDate(new Date(y, m - 1, i + 1));
    return { date, available: bookingSlots(departmentCode, date, patientId).some((s) => s.available) };
  });
}

/** 2-3: 그 시각에 빈 일정 후보 (무작위로 섞음) */
export function freeSchedulesAt(departmentCode: string, appointmentAt: string) {
  const [date, time] = appointmentAt.split("T");
  const candidates = departmentSchedules(departmentCode, date).filter((s) => slotTimes(s).includes(time) && isFreeSlot(s, date, time));
  return candidates.sort(() => Math.random() - 0.5);
}

export function hasSlotTime(departmentCode: string, appointmentAt: string) {
  const [date, time] = appointmentAt.split("T");
  return departmentSchedules(departmentCode, date).some((s) => slotTimes(s).includes(time));
}

// ---------- 06 청구 금액 계산 ----------

/** 진료번호별 청구 근거: 요청 검사(검사비), 원내 처방상세(약제비, 반올림 전) */
export function billingBasis(encounterId: number) {
  const d = db();
  const exams = d.exams.filter((e) => e.encounter_id === encounterId);
  const examFee = exams.reduce((sum, e) => sum + d.examItems.find((i) => i.exam_code === e.exam_code)!.fee, 0);
  const prescriptions = d.prescriptions.filter((p) => p.encounter_id === encounterId);
  const inHouse = prescriptions.filter((p) => p.dispense_type === "원내");
  const drugCost = d.prescriptionItems
    .filter((i) => inHouse.some((p) => p.prescription_id === i.prescription_id))
    .reduce((sum, i) => sum + d.drugs.find((x) => x.drug_code === i.drug_code)!.unit_price * i.dose * i.times_per_day * i.duration_days, 0);
  return {
    examNames: exams.map((e) => d.examItems.find((i) => i.exam_code === e.exam_code)!.name),
    examFee,
    drugCost,
    inHousePrescriptionCount: inHouse.length,
    hasOutsidePrescription: prescriptions.some((p) => p.dispense_type === "원외"),
  };
}

/** 외래 = 진찰료 + 검사비 + 약제비(합계 뒤 한 번 반올림) */
export function outpatientAmount(encounterId: number) {
  const b = billingBasis(encounterId);
  return CONSULTATION_FEE + b.examFee + Math.round(b.drugCost);
}

export function createPayment(encounterId: number, amount: number): PaymentRow {
  const d = db();
  const row: PaymentRow = {
    payment_id: d.payments.reduce((m, p) => Math.max(m, p.payment_id), 0) + 1,
    encounter_id: encounterId,
    amount,
    created_at: now(),
    method: null,
    status: "미결제",
    paid_at: null,
  };
  d.payments.push(row);
  return row;
}

export function toPayment(p: PaymentRow): Payment {
  const d = db();
  const encounter = d.encounters.find((e) => e.encounter_id === p.encounter_id)!;
  const admission = d.admissions.find((a) => a.decision_encounter_id === encounter.encounter_id) ?? null;
  const rounds = admission ? d.encounters.filter((e) => e.admission_id === admission.admission_id) : [];
  const bases = [encounter, ...rounds].map((e) => billingBasis(e.encounter_id));
  const doctor = staffOf(encounter.doctor_id);
  const days = admission?.discharged_at
    ? Math.max(1, Math.round((parse(admission.discharged_at.slice(0, 10)).getTime() - parse(admission.admitted_at.slice(0, 10)).getTime()) / 86_400_000))
    : null;
  return {
    paymentId: p.payment_id,
    encounterId: p.encounter_id,
    billingType: admission ? "입원" : "외래",
    amount: p.amount,
    status: p.status,
    method: p.method,
    createdAt: p.created_at,
    paidAt: p.paid_at,
    encounterAt: encounter.encounter_at,
    departmentName: departmentOf(doctor.department_code)?.name ?? "",
    admission: admission
      ? { admissionId: admission.admission_id, roomNo: admission.room_no, admittedAt: admission.admitted_at, dischargedAt: admission.discharged_at }
      : null,
    includes: {
      consultationCount: 1,
      examNames: bases.flatMap((b) => b.examNames),
      inHousePrescriptionCount: bases.reduce((n, b) => n + b.inHousePrescriptionCount, 0),
      hasOutsidePrescription: bases.some((b) => b.hasOutsidePrescription),
      roundCount: rounds.length,
      admissionDays: days,
    },
  };
}

// ---------- 03·04 진료와 검사 ----------

export function toEncounterDetail(e: EncounterRow, viewerStaffId: number | null, onlyCompletedExams: boolean): EncounterDetail {
  const d = db();
  const doctor = staffOf(e.doctor_id);
  const dept = departmentOf(doctor.department_code)!;
  const diagnoses = d.diagnoses
    .filter((x) => x.encounter_id === e.encounter_id)
    .map((x) => ({ diseaseCode: x.disease_code, diseaseName: d.diseases.find((y) => y.disease_code === x.disease_code)!.name, isPrimary: x.is_primary === "Y" }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const prescriptions = d.prescriptions
    .filter((p) => p.encounter_id === e.encounter_id)
    .map((p) => ({
      prescriptionId: p.prescription_id,
      dispenseType: p.dispense_type,
      prescribedAt: p.prescribed_at,
      items: d.prescriptionItems
        .filter((i) => i.prescription_id === p.prescription_id)
        .map((i) => {
          const drug = d.drugs.find((x) => x.drug_code === i.drug_code)!;
          return { drugCode: i.drug_code, drugName: drug.name, unit: drug.unit, dose: i.dose, timesPerDay: i.times_per_day, durationDays: i.duration_days, instruction: i.instruction };
        }),
    }));
  const exams = d.exams
    .filter((x) => x.encounter_id === e.encounter_id && (!onlyCompletedExams || x.status === "완료"))
    .map((x) => {
      const item = d.examItems.find((i) => i.exam_code === x.exam_code)!;
      return { examId: x.exam_id, examCode: x.exam_code, examName: item.name, category: item.category, status: x.status, requestedAt: x.requested_at };
    });
  const hasPayment = d.payments.some((p) => p.encounter_id === e.encounter_id && p.status !== "취소");
  const hasAdmission = d.admissions.some((a) => a.decision_encounter_id === e.encounter_id);
  return {
    encounterId: e.encounter_id,
    encounterType: e.encounter_type,
    encounterAt: e.encounter_at,
    patient: patientSummary(e.patient_id),
    doctorId: doctor.staff_id,
    doctorName: doctor.name,
    departmentCode: dept.department_code,
    departmentName: dept.name,
    reservationId: e.reservation_id,
    admissionId: e.admission_id,
    symptom: e.symptom,
    finding: e.finding,
    diagnoses,
    prescriptions,
    exams,
    admissionDecided: e.encounter_type === "외래" && (hasAdmission || !hasPayment),
    editable: viewerStaffId === e.doctor_id,
  };
}

export function toExam(x: ExamRow): Exam {
  const d = db();
  const item = d.examItems.find((i) => i.exam_code === x.exam_code)!;
  const encounter = d.encounters.find((e) => e.encounter_id === x.encounter_id)!;
  const doctor = staffOf(encounter.doctor_id);
  const reader = x.reader_id ? staffOf(x.reader_id) : null;
  return {
    examId: x.exam_id,
    status: x.status,
    examCode: x.exam_code,
    examName: item.name,
    category: item.category,
    referenceRange: item.reference_range,
    unit: item.unit,
    patient: patientSummary(encounter.patient_id),
    encounterId: x.encounter_id,
    requestDoctorId: doctor.staff_id,
    requestDoctorName: doctor.name,
    requestedAt: x.requested_at,
    performedAt: x.performed_at,
    resultValue: x.result_value,
    resultFlag: x.result_flag,
    readingNote: x.reading_note,
    readerId: x.reader_id,
    readerName: reader?.name ?? null,
  };
}
