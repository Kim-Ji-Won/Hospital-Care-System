/**
 * API 명세(docs/api)의 타입. ENUM 값은 DB 값(한글)을 그대로 씁니다.
 * 날짜는 문자열입니다: DATETIME "2026-11-11T10:00:00", DATE "2026-11-11", TIME "09:00:00"
 */

export type DateTime = string;
export type DateOnly = string;
export type TimeOnly = string;

// README ENUM 값
export type Gender = "남" | "여";
export type JobType = "의사" | "간호사" | "원무";
export type DayOfWeek = "월" | "화" | "수" | "목" | "금" | "토" | "일";
export type ReservationStatus = "예약" | "취소" | "완료" | "노쇼";
export type EncounterType = "외래" | "입원";
export type DispenseType = "원내" | "원외";
export type ExamStatus = "요청" | "시행" | "완료";
export type ResultFlag = "정상" | "이상";
export type ExamCategory = "혈액" | "영상" | "기능";
export type PaymentMethod = "카드" | "현금" | "계좌이체";
export type PaymentStatus = "미결제" | "완료" | "취소";

// API에만 있는 값
export type AccountType = "환자" | "의료진";
export type Role = "환자" | JobType;
export type BillingType = "외래" | "입원";

/** README 3. 오류 응답 */
export interface ApiErrorBody {
  code: string;
  message: string;
  fields: { field: string; reason: string }[] | null;
  details: Record<string, unknown> | null;
}

/** README 공통 객체: 환자 요약 */
export interface PatientSummary {
  patientId: number;
  name: string;
  birthDate: DateOnly;
  gender: Gender;
}

// ---------- 01 회원 관리 ----------

/** 01 로그인 사용자 객체 */
export interface SessionUser {
  role: Role;
  patientId: number | null;
  staffId: number | null;
  loginId: string;
  name: string;
  position: string | null;
  departmentCode: string | null;
  departmentName: string | null;
}

export interface LoginRequest {
  accountType: AccountType;
  loginId: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  birthDate: DateOnly;
  gender: Gender;
  phone: string;
  loginId: string;
  password: string;
}

/** 1-5 내 정보 */
export interface PatientProfile extends PatientSummary {
  phone: string;
  address: string | null;
  bloodType: string | null;
  loginId: string;
}

/** 1-6 환자 정보 (의료진용) */
export interface PatientDetail extends PatientProfile {
  lastEncounter: {
    encounterId: number;
    encounterAt: DateTime;
    encounterType: EncounterType;
    departmentName: string;
    primaryDiseaseName: string | null;
  } | null;
  nextReservation: {
    reservationId: number;
    appointmentAt: DateTime;
    departmentName: string;
    doctorName: string;
  } | null;
  currentAdmission: {
    admissionId: number;
    roomNo: number;
    ward: string;
    admittedAt: DateTime;
  } | null;
}

/** 1-7 진료과 */
export interface Department {
  departmentCode: string;
  name: string;
  location: string | null;
  phone: string | null;
  staffCount: number;
}

// ---------- 02 예약 관리 ----------

/** 2-1 예약 가능한 날짜 */
export interface BookingDate {
  date: DateOnly;
  available: boolean;
}

/** 2-2 예약 가능한 시간 */
export interface BookingSlot {
  time: TimeOnly;
  available: boolean;
  mine: boolean;
}

/** 내 예약 객체 (2-3, 2-4) */
export interface MyReservation {
  reservationId: number;
  appointmentAt: DateTime;
  status: ReservationStatus;
  symptomNote: string | null;
  createdAt: DateTime;
  departmentCode: string;
  departmentName: string;
  departmentLocation: string | null;
  doctorId: number;
  doctorName: string;
  encounterId: number | null;
}

export interface CreateReservationRequest {
  departmentCode: string;
  appointmentAt: DateTime;
  symptomNote: string | null;
}

/** 예약 항목 (의료진용, 2-5 ~ 2-7) */
export interface StaffReservation {
  reservationId: number;
  appointmentAt: DateTime;
  status: ReservationStatus;
  symptomNote: string | null;
  patient: PatientSummary;
  scheduleId: number;
  doctorId: number;
  doctorName: string;
  departmentCode: string;
  departmentName: string;
  encounterId: number | null;
}

/** 휴진 객체 */
export interface DayOff {
  dayOffId: number;
  scheduleId: number;
  offDate: DateOnly;
  reason: string | null;
  doctorId: number;
  doctorName?: string;
  dayOfWeek: DayOfWeek;
  startTime: TimeOnly;
  endTime: TimeOnly;
}

/** 2-5 오늘 진료 목록 */
export interface DailyReservations {
  date: DateOnly;
  dayOffs: DayOff[];
  reservations: StaffReservation[];
}

// ---------- 03 진료 관리 ----------

export interface EncounterDiagnosis {
  diseaseCode: string;
  diseaseName: string;
  isPrimary: boolean;
}

export interface EncounterPrescriptionItem {
  drugCode: string;
  drugName: string;
  unit: string;
  dose: number;
  timesPerDay: number;
  durationDays: number;
  instruction: string;
}

export interface EncounterPrescription {
  prescriptionId: number;
  dispenseType: DispenseType;
  prescribedAt: DateTime;
  items: EncounterPrescriptionItem[];
}

export interface EncounterExam {
  examId: number;
  examCode: string;
  examName: string;
  category: ExamCategory;
  status: ExamStatus;
  requestedAt: DateTime;
}

/** 진료 상세 객체 (3-2, 3-3) */
export interface EncounterDetail {
  encounterId: number;
  encounterType: EncounterType;
  encounterAt: DateTime;
  patient: PatientSummary;
  doctorId: number;
  doctorName: string;
  departmentCode: string;
  departmentName: string;
  reservationId: number | null;
  admissionId: number | null;
  symptom: string | null;
  finding: string;
  diagnoses: EncounterDiagnosis[];
  prescriptions: EncounterPrescription[];
  exams: EncounterExam[];
  admissionDecided: boolean;
  editable: boolean;
}

/** 3-1 진료 기록 저장 요청 */
export interface CreateEncounterRequest {
  reservationId: number | null;
  admissionId: number | null;
  encounterAt: DateTime | null;
  symptom: string | null;
  finding: string;
  diagnoses: { diseaseCode: string; isPrimary: boolean }[];
  prescriptions: {
    dispenseType: DispenseType;
    items: { drugCode: string; dose: number; timesPerDay: number; durationDays: number; instruction: string }[];
  }[];
  exams: { examCode: string }[];
  admissionDecided: boolean;
}

export interface CreateEncounterResponse {
  encounterId: number;
  encounterType: EncounterType;
  encounterAt: DateTime;
  reservationId: number | null;
  admissionId: number | null;
  admissionDecided: boolean;
  paymentId: number | null;
}

// ---------- 04 처방·검사 관리 ----------

/** 검사 객체 (4-1 ~ 4-3) */
export interface Exam {
  examId: number;
  status: ExamStatus;
  examCode: string;
  examName: string;
  category: ExamCategory;
  referenceRange: string | null;
  unit: string | null;
  patient: PatientSummary;
  encounterId: number;
  requestDoctorId: number;
  requestDoctorName: string;
  requestedAt: DateTime;
  performedAt: DateTime | null;
  resultValue: number | null;
  resultFlag: ResultFlag | null;
  readingNote: string | null;
  readerId: number | null;
  readerName: string | null;
}

export interface CompleteExamRequest {
  resultValue: number | null;
  resultFlag: ResultFlag;
  readingNote: string;
}

/** 4-4 내 검사 결과 */
export interface MyExam {
  examId: number;
  examCode: string;
  examName: string;
  category: ExamCategory;
  referenceRange: string | null;
  unit: string | null;
  resultValue: number | null;
  resultFlag: ResultFlag;
  readingNote: string;
  readerName: string;
  performedAt: DateTime;
  encounterId: number;
  encounterAt: DateTime;
}

export interface Disease {
  diseaseCode: string;
  name: string;
  usageCount: number;
}

export interface Drug {
  drugCode: string;
  name: string;
  ingredient: string | null;
  form: string;
  unit: string;
  unitPrice: number;
}

export interface ExamItem {
  examCode: string;
  name: string;
  category: ExamCategory;
  referenceRange: string | null;
  unit: string | null;
  fee: number;
}

// ---------- 06 결제 관리 ----------

/** 결제 객체 */
export interface Payment {
  paymentId: number;
  encounterId: number;
  billingType: BillingType;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
  createdAt: DateTime;
  paidAt: DateTime | null;
  encounterAt: DateTime;
  departmentName: string;
  admission: { admissionId: number; roomNo: number; admittedAt: DateTime; dischargedAt: DateTime | null } | null;
  includes: {
    consultationCount: number;
    examNames: string[];
    inHousePrescriptionCount: number;
    hasOutsidePrescription: boolean;
    roundCount: number;
    admissionDays: number | null;
  };
}

// ---------- 05 입·퇴원 ----------

/** 5-1 병실 현황 */
export interface Room {
  roomNo: number;
  ward: string;
  bedCount: number;
  /** 퇴원일시가 NULL인 입원 수 (테이블에 없는 값) */
  occupiedBeds: number;
  dailyFee: number;
}

/** 5-2 입원 배정 대기 */
export interface PendingAdmission {
  decisionEncounterId: number;
  decidedAt: DateTime;
  patient: PatientSummary;
  doctorId: number;
  doctorName: string;
  departmentName: string;
}

/** 입원 객체 (5-3 ~ 5-6) */
export interface Admission {
  admissionId: number;
  patient: PatientSummary;
  decisionEncounterId: number;
  attendingId: number;
  attendingName: string;
  roomNo: number;
  ward: string;
  admittedAt: DateTime;
  /** null이면 화면에 "미정" */
  expectedDischargeDate: DateOnly | null;
  dischargedAt: DateTime | null;
  reason: string;
}

export interface AdmissionRound {
  encounterId: number;
  encounterAt: DateTime;
  doctorId: number;
  doctorName: string;
  finding: string;
}

/** 5-5 입원 한 건: 입원 객체 + 회진(진료일시 내림차순) + 건수 */
export interface AdmissionDetail extends Admission {
  rounds: AdmissionRound[];
  summary: { roundCount: number; examCount: number; inHousePrescriptionCount: number };
}

/** 5-3 병실 배정 */
export interface CreateAdmissionRequest {
  decisionEncounterId: number;
  roomNo: number;
  attendingId: number;
  reason: string;
  expectedDischargeDate: DateOnly | null;
}

/** 5-6 퇴원 처리 응답 */
export interface DischargeResponse {
  admission: Admission;
  payment: { paymentId: number; encounterId: number; amount: number; status: PaymentStatus };
}

/** 5-7 내 입원 내역: 입원 객체에서 patient를 빼고 회진을 더한 모양 */
export interface MyAdmission extends Omit<Admission, "patient"> {
  rounds: { encounterAt: DateTime; doctorName: string; finding: string }[];
}

/** 1-8 의료진 객체 (비밀번호해시는 내보내지 않음) */
export interface Staff {
  staffId: number;
  name: string;
  jobType: JobType;
  position: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  phone: string;
  loginId: string;
}

/** 6-4 결제 취소 응답: 취소로 보관한 결제 + 지금 단가로 다시 계산한 새 미결제 */
export interface CancelPaymentResponse {
  cancelled: Payment;
  newPayment: Payment;
}

// ---------- 02 진료일정·휴진 (2-10 ~ 2-17) ----------

/** 진료일정 객체 */
export interface Schedule {
  scheduleId: number;
  doctorId: number;
  doctorName: string;
  dayOfWeek: DayOfWeek;
  startTime: TimeOnly;
  endTime: TimeOnly;
  slotMinutes: number;
  /** 이 일정을 쓰는 예약 수(상태 무관). 0일 때만 닫을 수 있음 */
  reservationCount: number;
  /** 지금 이후 '예약' 상태인 예약 수 */
  upcomingCount: number;
}

export interface CreateScheduleRequest {
  doctorId: number;
  dayOfWeek: DayOfWeek;
  startTime: TimeOnly;
  endTime: TimeOnly;
  slotMinutes: number;
}

export type UpdateScheduleRequest = Partial<Pick<CreateScheduleRequest, "startTime" | "endTime" | "slotMinutes">>;

/** 2-15 휴진 영향, 2-16 실제 결과 */
export interface DayOffImpact {
  date: DateOnly;
  reassigned: { reservationId: number; appointmentAt: DateTime; patient: PatientSummary; toDoctorId: number; toDoctorName: string }[];
  cancelled: { reservationId: number; appointmentAt: DateTime; patient: PatientSummary }[];
}

export interface CreateDayOffRequest {
  scheduleIds: number[];
  offDate: DateOnly;
  reason: string | null;
}

export interface CreateDayOffResponse extends Omit<DayOffImpact, "date"> {
  dayOffs: DayOff[];
}

// ---------- 01 환자 검색·수정·이력 (1-9 ~ 1-11) ----------

/** 1-9 환자 검색 결과 */
export interface PatientSearchItem extends PatientSummary {
  phone: string;
  /** 지금 입원 중인지 (S3 '입원 중' 칩) */
  admitted: boolean;
}

/** 1-10 환자 정보 수정: 고친 필드만 */
export interface UpdatePatientRequest {
  name?: string;
  birthDate?: DateOnly;
  gender?: Gender;
  phone?: string;
  address?: string | null;
  bloodType?: string | null;
}

/** 1-11 환자 이력: 종류별 배열(각각 시각 내림차순). 화면이 한 표로 합침 */
export interface PatientHistory {
  reservations: { reservationId: number; appointmentAt: DateTime; status: ReservationStatus; departmentName: string; doctorName: string; symptomNote: string | null }[];
  encounters: { encounterId: number; encounterAt: DateTime; encounterType: EncounterType; departmentName: string; doctorName: string; primaryDiseaseCode: string | null; primaryDiseaseName: string | null }[];
  exams: { examId: number; examName: string; status: ExamStatus; requestedAt: DateTime; performedAt: DateTime | null; resultValue: number | null; unit: string | null; resultFlag: ResultFlag | null }[];
  admissions: { admissionId: number; admittedAt: DateTime; dischargedAt: DateTime | null; roomNo: number; attendingName: string }[];
  payments: { paymentId: number; encounterId: number; amount: number; status: PaymentStatus; createdAt: DateTime; paidAt: DateTime | null }[];
}

// ---------- 기준 정보 추가·수정 (1-12 ~ 1-14, 4-8 ~ 4-10, 5-8) ----------

export interface CreateStaffRequest {
  name: string;
  phone: string;
  jobType: JobType;
  position: string | null;
  departmentCode: string | null;
  loginId: string;
  password: string;
}
export type UpdateStaffRequest = Partial<Pick<CreateStaffRequest, "name" | "phone" | "position">>;
export interface DepartmentInput {
  departmentCode: string;
  name: string;
  location: string | null;
  phone: string | null;
}
export interface DiseaseInput {
  diseaseCode: string;
  name: string;
}
export type DrugInput = Omit<Drug, never>;
export type ExamItemInput = Omit<ExamItem, never>;
export type RoomInput = Omit<Room, "occupiedBeds">;
