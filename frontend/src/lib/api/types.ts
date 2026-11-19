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
