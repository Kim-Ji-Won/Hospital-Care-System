/**
 * 목 서버의 메모리 DB. 개발용이라 백엔드 시드와 같지 않아도 됩니다.
 * 새로고침해도 시연 흐름이 이어지도록 localStorage에 저장합니다.
 * 표본 값은 Figma 시안(김서연 #10234, 박지훈 #12 등)에서 가져왔습니다.
 */
import type { DayOfWeek, Gender, JobType } from "@/lib/api/types";

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

export interface MockDb {
  version: number;
  departments: DepartmentRow[];
  staff: StaffRow[];
  patients: PatientRow[];
  schedules: ScheduleRow[];
  /** 로그인한 사용자 (세션 대신) */
  session: { accountType: "환자"; id: number } | { accountType: "의료진"; id: number } | null;
}

const VERSION = 1;
const STORAGE_KEY = "mock:db";

function seed(): MockDb {
  return {
    version: VERSION,
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
    ],
    schedules: [
      { schedule_id: 14, doctor_id: 12, day_of_week: "수", start_time: "09:00:00", end_time: "12:00:00", slot_minutes: 30 },
      { schedule_id: 15, doctor_id: 15, day_of_week: "수", start_time: "09:00:00", end_time: "12:00:00", slot_minutes: 30 },
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
    cache = parsed && parsed.version === VERSION ? parsed : seed();
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

/** 시연 패널의 빠른 로그인용 계정 목록 */
export function demoAccounts() {
  const d = db();
  return [
    ...d.patients.filter((p) => p.login_id).map((p) => ({ accountType: "환자" as const, role: "환자", name: p.name, loginId: p.login_id!, password: p.password! })),
    ...d.staff.map((s) => ({ accountType: "의료진" as const, role: s.job_type, name: s.name, loginId: s.login_id, password: s.password })),
  ];
}
