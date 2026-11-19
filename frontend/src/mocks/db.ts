/**
 * 목 서버의 메모리 DB. 개발용이라 백엔드 시드와 같지 않아도 됩니다.
 * 컬럼 이름은 테이블정의서와 같게(snake_case) 두고, 핸들러가 API 모양(camelCase)으로 바꿉니다.
 * 새로고침해도 시연 흐름이 이어지도록 localStorage에 저장합니다.
 * 표본 값은 Figma 시안(김서연 #10234, 박지훈 #12 등)에서 가져왔고, 날짜는 오늘을 기준으로 만듭니다.
 */
import type {
  DayOfWeek,
  DispenseType,
  EncounterType,
  ExamCategory,
  ExamStatus,
  Gender,
  JobType,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  ResultFlag,
} from "@/lib/api/types";
import { addDays, today } from "@/lib/date";

export interface PatientRow {
  patient_id: number;
  name: string;
  birth_date: string;
  gender: Gender;
  phone: string;
  address: string | null;
  blood_type: string | null;
  login_id: string | null;
  password: string | null; // 목 서버라 평문. 실제 백엔드는 BCrypt 해시
}

export interface StaffRow {
  staff_id: number;
  department_code: string | null;
  name: string;
  phone: string;
  job_type: JobType;
  position: string | null;
  login_id: string;
  password: string;
}

export interface DepartmentRow {
  department_code: string;
  name: string;
  location: string | null;
  phone: string | null;
}

export interface ScheduleRow {
  schedule_id: number;
  doctor_id: number;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  slot_minutes: number;
}

export interface DayOffRow {
  day_off_id: number;
  schedule_id: number;
  off_date: string;
  reason: string | null;
}

export interface ReservationRow {
  reservation_id: number;
  patient_id: number;
  schedule_id: number;
  appointment_at: string;
  status: ReservationStatus;
  created_at: string;
  symptom_note: string | null;
}

export interface EncounterRow {
  encounter_id: number;
  patient_id: number;
  doctor_id: number;
  reservation_id: number | null;
  admission_id: number | null;
  encounter_at: string;
  encounter_type: EncounterType;
  symptom: string | null;
  finding: string;
}

export interface DiagnosisRow {
  encounter_id: number;
  disease_code: string;
  is_primary: "Y" | "N";
}

export interface PrescriptionRow {
  prescription_id: number;
  encounter_id: number;
  prescribed_at: string;
  dispense_type: DispenseType;
}

export interface PrescriptionItemRow {
  prescription_id: number;
  drug_code: string;
  dose: number;
  times_per_day: number;
  duration_days: number;
  instruction: string;
}

export interface ExamRow {
  exam_id: number;
  encounter_id: number;
  exam_code: string;
  reader_id: number | null;
  requested_at: string;
  performed_at: string | null;
  status: ExamStatus;
  result_value: number | null;
  result_flag: ResultFlag | null;
  reading_note: string | null;
}

export interface AdmissionRow {
  admission_id: number;
  decision_encounter_id: number;
  attending_id: number;
  room_no: number;
  admitted_at: string;
  expected_discharge_date: string | null;
  discharged_at: string | null;
  reason: string;
}

export interface PaymentRow {
  payment_id: number;
  encounter_id: number;
  amount: number;
  created_at: string;
  method: PaymentMethod | null;
  status: PaymentStatus;
  paid_at: string | null;
}

export interface DiseaseRow {
  disease_code: string;
  name: string;
}

export interface DrugRow {
  drug_code: string;
  name: string;
  ingredient: string | null;
  form: string;
  unit: string;
  unit_price: number;
}

export interface ExamItemRow {
  exam_code: string;
  name: string;
  category: ExamCategory;
  reference_range: string | null;
  unit: string | null;
  fee: number;
}

export interface RoomRow {
  room_no: number;
  ward: string;
  bed_count: number;
  daily_fee: number;
}

export interface MockDb {
  version: number;
  seededOn: string;
  departments: DepartmentRow[];
  staff: StaffRow[];
  patients: PatientRow[];
  schedules: ScheduleRow[];
  dayOffs: DayOffRow[];
  reservations: ReservationRow[];
  encounters: EncounterRow[];
  diagnoses: DiagnosisRow[];
  prescriptions: PrescriptionRow[];
  prescriptionItems: PrescriptionItemRow[];
  exams: ExamRow[];
  admissions: AdmissionRow[];
  payments: PaymentRow[];
  diseases: DiseaseRow[];
  drugs: DrugRow[];
  examItems: ExamItemRow[];
  rooms: RoomRow[];
  /** 로그인한 사용자 (세션 대신) */
  session: { accountType: "환자" | "의료진"; id: number } | null;
}

const VERSION = 3;
const STORAGE_KEY = "mock:db";
const ALL_DAYS: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

function seed(): MockDb {
  const t = today();
  const at = (dayOffset: number, time: string) => `${addDays(t, dayOffset)}T${time}`;

  // 시연이 요일과 상관없이 되도록 목 서버 일정은 매일 있습니다(실제 일정은 백엔드 시드가 정함).
  let scheduleId = 10;
  const schedules: ScheduleRow[] = [];
  const addSchedules = (doctorId: number, start: string, end: string, minutes: number) =>
    ALL_DAYS.forEach((day) =>
      schedules.push({ schedule_id: scheduleId++, doctor_id: doctorId, day_of_week: day, start_time: start, end_time: end, slot_minutes: minutes }),
    );
  addSchedules(12, "09:00:00", "12:00:00", 30); // 박지훈 오전
  addSchedules(12, "14:00:00", "17:00:00", 30); // 박지훈 오후
  addSchedules(15, "09:00:00", "12:00:00", 30); // 이도윤 오전
  addSchedules(15, "14:00:00", "17:00:00", 30); // 이도윤 오후
  addSchedules(18, "09:00:00", "12:00:00", 30); // 강민재 오전
  const sid = (doctorId: number, dayOffset: number, afternoon = false) => {
    const day = ["일", "월", "화", "수", "목", "금", "토"][new Date(`${addDays(t, dayOffset)}T00:00:00`).getDay()];
    const s = schedules.find((x) => x.doctor_id === doctorId && x.day_of_week === day && (afternoon ? x.start_time >= "13" : x.start_time < "13"));
    return s!.schedule_id;
  };

  return {
    version: VERSION,
    seededOn: t,
    departments: [
      { department_code: "IM", name: "내과", location: "본관 2층", phone: "02-555-0121" },
      { department_code: "GS", name: "외과", location: "본관 3층", phone: "02-555-0131" },
      { department_code: "OS", name: "정형외과", location: "본관 3층", phone: "02-555-0133" },
      { department_code: "PD", name: "소아청소년과", location: "별관 1층", phone: null },
    ],
    staff: [
      { staff_id: 12, department_code: "IM", name: "박지훈", phone: "010-5550-0112", job_type: "의사", position: "전문의", login_id: "jhpark", password: "demo1234" },
      { staff_id: 15, department_code: "IM", name: "이도윤", phone: "010-5550-0115", job_type: "의사", position: "전문의", login_id: "dylee", password: "demo1234" },
      { staff_id: 18, department_code: "OS", name: "강민재", phone: "010-5550-0118", job_type: "의사", position: "전문의", login_id: "mjkang", password: "demo1234" },
      { staff_id: 21, department_code: "IM", name: "최유나", phone: "010-5550-0121", job_type: "간호사", position: null, login_id: "ynchoi", password: "demo1234" },
      { staff_id: 30, department_code: null, name: "이수민", phone: "010-5550-0130", job_type: "원무", position: null, login_id: "smlee", password: "demo1234" },
    ],
    patients: [
      { patient_id: 10234, name: "김서연", birth_date: "1994-03-12", gender: "여", phone: "010-5550-4821", address: "서울 성북구 보문로", blood_type: "A형 (Rh+)", login_id: "seoyeon01", password: "demo1234" },
      { patient_id: 10388, name: "정하늘", birth_date: "1968-05-21", gender: "남", phone: "010-5550-2290", address: null, blood_type: null, login_id: "haneul68", password: "demo1234" },
      { patient_id: 9412, name: "김서현", birth_date: "1968-11-02", gender: "여", phone: "010-5550-7735", address: null, blood_type: "O형 (Rh+)", login_id: "seohyun", password: "demo1234" },
      { patient_id: 10412, name: "문가은", birth_date: "1960-08-03", gender: "여", phone: "010-5550-3318", address: null, blood_type: null, login_id: "gaeun60", password: "demo1234" },
      { patient_id: 10521, name: "오세린", birth_date: "1985-01-19", gender: "여", phone: "010-5550-6402", address: null, blood_type: null, login_id: "serin85", password: "demo1234" },
      { patient_id: 10633, name: "한지우", birth_date: "1999-02-14", gender: "남", phone: "010-5550-0163", address: null, blood_type: null, login_id: "jiwoo99", password: "demo1234" },
    ],
    schedules,
    dayOffs: [],
    reservations: [
      // 오늘 박지훈 오전: 완료·노쇼·대기 3 (S1 시안과 같은 구성)
      { reservation_id: 1195, patient_id: 10388, schedule_id: sid(12, 0), appointment_at: at(0, "09:00:00"), status: "완료", created_at: at(-3, "18:20:00"), symptom_note: null },
      { reservation_id: 1196, patient_id: 10521, schedule_id: sid(12, 0), appointment_at: at(0, "09:30:00"), status: "노쇼", created_at: at(-2, "11:02:00"), symptom_note: "두통, 어지러움" },
      { reservation_id: 1201, patient_id: 10234, schedule_id: sid(12, 0), appointment_at: at(0, "10:00:00"), status: "예약", created_at: at(-2, "21:14:05"), symptom_note: "식후 속쓰림이 일주일째" },
      { reservation_id: 1202, patient_id: 10633, schedule_id: sid(12, 0), appointment_at: at(0, "10:30:00"), status: "예약", created_at: at(-1, "08:40:00"), symptom_note: "기침 3일" },
      { reservation_id: 1203, patient_id: 10412, schedule_id: sid(12, 0), appointment_at: at(0, "11:00:00"), status: "예약", created_at: at(-1, "13:10:00"), symptom_note: "혈압약 재처방" },
      // 김서연의 다른 예약
      { reservation_id: 1240, patient_id: 10234, schedule_id: sid(15, 12, true), appointment_at: at(12, "14:00:00"), status: "예약", created_at: at(-1, "20:00:00"), symptom_note: "혈압 재진" },
      { reservation_id: 1102, patient_id: 10234, schedule_id: sid(12, -14), appointment_at: at(-14, "09:30:00"), status: "완료", created_at: at(-18, "10:00:00"), symptom_note: "속쓰림" },
      { reservation_id: 1060, patient_id: 10234, schedule_id: sid(18, -40), appointment_at: at(-40, "11:00:00"), status: "취소", created_at: at(-45, "09:00:00"), symptom_note: "발목 통증" },
      { reservation_id: 1011, patient_id: 10234, schedule_id: sid(12, -57), appointment_at: at(-57, "11:00:00"), status: "노쇼", created_at: at(-60, "09:00:00"), symptom_note: null },
      // 작년 예약: 올해가 아닌 날짜에 연도가 붙는지 보여 주는 표본 (-400일이면 언제 시연해도 작년 이전)
      { reservation_id: 990, patient_id: 10234, schedule_id: sid(15, -400, true), appointment_at: at(-400, "15:00:00"), status: "취소", created_at: at(-405, "19:30:00"), symptom_note: "건강검진 상담" },
      // 정하늘 지난 진료
      { reservation_id: 1088, patient_id: 10388, schedule_id: sid(12, -20), appointment_at: at(-20, "10:00:00"), status: "완료", created_at: at(-25, "09:00:00"), symptom_note: "정기 검진" },
    ],
    encounters: [
      { encounter_id: 5521, patient_id: 10234, doctor_id: 12, reservation_id: 1102, admission_id: null, encounter_at: at(-14, "09:35:00"), encounter_type: "외래", symptom: "속쓰림", finding: "위 점막 자극 소견. 2주 복약 후 경과 관찰." },
      { encounter_id: 5528, patient_id: 10388, doctor_id: 12, reservation_id: 1195, admission_id: null, encounter_at: at(0, "09:12:00"), encounter_type: "외래", symptom: null, finding: "흉부 불편감. 검사 후 재평가." },
      { encounter_id: 5490, patient_id: 10388, doctor_id: 12, reservation_id: 1088, admission_id: null, encounter_at: at(-20, "10:05:00"), encounter_type: "외래", symptom: "정기 검진", finding: "특이 소견 없음" },
    ],
    diagnoses: [
      { encounter_id: 5521, disease_code: "K29.7", is_primary: "Y" },
      { encounter_id: 5521, disease_code: "K21.0", is_primary: "N" },
      { encounter_id: 5528, disease_code: "R07.4", is_primary: "Y" },
      { encounter_id: 5490, disease_code: "Z00.0", is_primary: "Y" },
    ],
    prescriptions: [{ prescription_id: 7001, encounter_id: 5521, prescribed_at: at(-14, "09:35:00"), dispense_type: "원외" }],
    prescriptionItems: [
      { prescription_id: 7001, drug_code: "D305", dose: 1, times_per_day: 1, duration_days: 14, instruction: "아침 식전" },
      { prescription_id: 7001, drug_code: "D412", dose: 1, times_per_day: 3, duration_days: 7, instruction: "식후 1시간" },
    ],
    exams: [
      { exam_id: 3290, encounter_id: 5521, exam_code: "L101", reader_id: 12, requested_at: at(-14, "09:35:00"), performed_at: at(-13, "14:20:00"), status: "완료", result_value: 11.8, result_flag: "이상", reading_note: "경미한 백혈구 증가. 염증 반응 의심, 2주 뒤 재검 권장." },
      { exam_id: 3291, encounter_id: 5521, exam_code: "L103", reader_id: 12, requested_at: at(-14, "09:35:00"), performed_at: at(-13, "14:25:00"), status: "완료", result_value: 0.3, result_flag: "정상", reading_note: "정상 범위." },
      { exam_id: 3295, encounter_id: 5521, exam_code: "R202", reader_id: 15, requested_at: at(-14, "09:35:00"), performed_at: at(-12, "11:00:00"), status: "완료", result_value: null, result_flag: "정상", reading_note: "특이 소견 없음." },
      { exam_id: 3301, encounter_id: 5528, exam_code: "L101", reader_id: null, requested_at: at(0, "09:12:00"), performed_at: null, status: "요청", result_value: null, result_flag: null, reading_note: null },
      { exam_id: 3302, encounter_id: 5528, exam_code: "F301", reader_id: null, requested_at: at(0, "09:12:00"), performed_at: at(0, "09:40:00"), status: "시행", result_value: null, result_flag: null, reading_note: null },
      { exam_id: 3280, encounter_id: 5490, exam_code: "L102", reader_id: 12, requested_at: at(-20, "10:05:00"), performed_at: at(-20, "10:40:00"), status: "완료", result_value: 92, result_flag: "정상", reading_note: "정상 범위." },
    ],
    admissions: [],
    payments: [
      // 김서연 2주 전 외래: 진찰 15,000 + 일반혈액 8,000 + CRP 15,500 + 복부 CT 60,000 (원외 처방은 제외)
      { payment_id: 9077, encounter_id: 5521, amount: 98500, created_at: at(-14, "10:42:00"), method: null, status: "미결제", paid_at: null },
      // 정하늘 오늘 외래: 진찰 15,000 + 일반혈액 8,000 + 심전도 12,000
      { payment_id: 9101, encounter_id: 5528, amount: 35000, created_at: at(0, "09:20:00"), method: null, status: "미결제", paid_at: null },
      // 정하늘 지난 외래: 진찰 15,000 + 공복 혈당 5,000
      { payment_id: 9050, encounter_id: 5490, amount: 20000, created_at: at(-20, "10:30:00"), method: "카드", status: "완료", paid_at: at(-20, "10:51:00") },
    ],
    diseases: [
      { disease_code: "J00", name: "급성 비인두염(감기)" },
      { disease_code: "J20.9", name: "급성 기관지염" },
      { disease_code: "K21.0", name: "역류성 식도염" },
      { disease_code: "K29.7", name: "위염" },
      { disease_code: "K35.8", name: "급성 충수염" },
      { disease_code: "I10", name: "본태성 고혈압" },
      { disease_code: "E11.9", name: "제2형 당뇨병" },
      { disease_code: "R07.4", name: "상세불명의 흉통" },
      { disease_code: "S93.4", name: "발목 염좌" },
      { disease_code: "Z00.0", name: "일반 건강검진" },
    ],
    drugs: [
      { drug_code: "D201", name: "타이레놀정 500mg", ingredient: "아세트아미노펜", form: "정제", unit: "정", unit_price: 120 },
      { drug_code: "D305", name: "에소메프라졸정 20mg", ingredient: "에소메프라졸", form: "정제", unit: "정", unit_price: 680 },
      { drug_code: "D412", name: "알마게이트현탁액", ingredient: "알마게이트", form: "현탁액", unit: "포", unit_price: 310 },
      { drug_code: "D420", name: "암로디핀정 5mg", ingredient: "암로디핀", form: "정제", unit: "정", unit_price: 210 },
      { drug_code: "D510", name: "코대원포르테시럽", ingredient: "디히드로코데인", form: "시럽", unit: "mL", unit_price: 15 },
      { drug_code: "D550", name: "세프트리악손주 1g", ingredient: "세프트리악손", form: "주사제", unit: "바이알", unit_price: 4200 },
      { drug_code: "D551", name: "세프라딘캡슐 500mg", ingredient: "세프라딘", form: "캡슐", unit: "캡슐", unit_price: 240 },
    ],
    examItems: [
      { exam_code: "L101", name: "일반혈액검사", category: "혈액", reference_range: "4.0~10.0", unit: "×10³/µL", fee: 8000 },
      { exam_code: "L102", name: "공복 혈당", category: "혈액", reference_range: "70~99", unit: "mg/dL", fee: 5000 },
      { exam_code: "L103", name: "CRP", category: "혈액", reference_range: "0.0~0.5", unit: "mg/dL", fee: 15500 },
      { exam_code: "R201", name: "흉부 X선", category: "영상", reference_range: null, unit: null, fee: 15500 },
      { exam_code: "R202", name: "복부 CT", category: "영상", reference_range: null, unit: null, fee: 60000 },
      { exam_code: "F301", name: "심전도", category: "기능", reference_range: null, unit: null, fee: 12000 },
    ],
    rooms: [
      { room_no: 501, ward: "5층", bed_count: 4, daily_fee: 60000 },
      { room_no: 502, ward: "5층", bed_count: 4, daily_fee: 60000 },
      { room_no: 503, ward: "5층", bed_count: 4, daily_fee: 60000 },
      { room_no: 504, ward: "5층", bed_count: 2, daily_fee: 90000 },
    ],
    session: null,
  };
}

let cache: MockDb | null = null;

export function db(): MockDb {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as MockDb) : null;
    // 버전이 바뀌었거나 다른 날 만든 데이터면 새로 만듭니다("오늘 진료"가 오늘 날짜로 보이도록). 로그인은 유지.
    cache = parsed && parsed.version === VERSION && parsed.seededOn === today() ? parsed : { ...seed(), session: parsed?.session ?? null };
  } catch {
    cache = seed();
  }
  return cache;
}

export function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db()));
  } catch {
    // 저장할 수 없으면 메모리에만 둠
  }
}

/** 시연 패널의 "데이터 초기화" */
export function resetDb() {
  cache = seed();
  save();
}

/** AUTO_INCREMENT 흉내: 그 테이블의 가장 큰 번호 + 1 */
export function nextId<T>(rows: T[], key: keyof T) {
  return rows.reduce((max, r) => Math.max(max, Number(r[key])), 0) + 1;
}

/** 시연 패널의 빠른 로그인용 계정 목록 (환자는 앞의 셋만) */
export function demoAccounts() {
  const d = db();
  return [
    ...d.patients.slice(0, 3).filter((p) => p.login_id).map((p) => ({ accountType: "환자" as const, role: "환자", name: p.name, loginId: p.login_id!, password: p.password! })),
    ...d.staff.map((s) => ({ accountType: "의료진" as const, role: s.job_type, name: s.name, loginId: s.login_id, password: s.password })),
  ];
}
