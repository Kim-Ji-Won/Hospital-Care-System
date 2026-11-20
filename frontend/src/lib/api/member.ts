/** 01 회원 관리 (배성진) — docs/api/01-member.md */
import { api } from "./client";
import type {
  CreateStaffRequest,
  Department,
  DepartmentInput,
  JobType,
  LoginRequest,
  PatientDetail,
  PatientHistory,
  PatientProfile,
  PatientSearchItem,
  SessionUser,
  SignupRequest,
  Staff,
  UpdatePatientRequest,
  UpdateStaffRequest,
} from "./types";

/** 쿼리 키 묶음. 화면에서는 배열을 직접 적지 않고 이것만 씁니다. (로그인 정보 키는 lib/auth의 ME_KEY) */
export const memberKeys = {
  all: ["member"] as const,
  profile: () => [...memberKeys.all, "profile"] as const,
  patient: (patientId: number) => [...memberKeys.all, "patient", patientId] as const,
  departments: () => [...memberKeys.all, "departments"] as const,
  staff: (jobType?: JobType, departmentCode?: string) => [...memberKeys.all, "staff", jobType ?? "", departmentCode ?? ""] as const,
  search: (q: string) => [...memberKeys.all, "search", q] as const,
  history: (patientId: number) => [...memberKeys.all, "history", patientId] as const,
};

export const memberApi = {
  /** 1-1 로그인 */
  login: (body: LoginRequest) => api.post<SessionUser>("/api/auth/login", body),
  /** 1-2 로그아웃 */
  logout: () => api.post<void>("/api/auth/logout"),
  /** 1-3 로그인 상태 확인 */
  me: () => api.get<SessionUser>("/api/auth/me"),
  /** 1-4 회원가입 (환자 등록) */
  signup: (body: SignupRequest) => api.post<SessionUser>("/api/auth/signup", body),
  /** 1-5 내 정보 */
  myProfile: () => api.get<PatientProfile>("/api/me/profile"),
  /** 1-6 환자 정보 (의료진용) */
  patient: (patientId: number) => api.get<PatientDetail>(`/api/patients/${patientId}`),
  /** 1-7 진료과 목록 */
  departments: () => api.get<Department[]>("/api/departments"),
  /** 1-8 의료진 목록 (주치의는 jobType=의사) */
  staff: (jobType?: JobType, departmentCode?: string) => api.get<Staff[]>("/api/staff", { jobType, departmentCode }),
  /** 1-9 환자 검색 (이름, 환자번호, 연락처 뒷자리) */
  search: (q: string) => api.get<PatientSearchItem[]>("/api/patients", { q }),
  /** 1-10 환자 정보 수정 (고친 필드만) */
  update: (patientId: number, body: UpdatePatientRequest) => api.patch<PatientProfile>(`/api/patients/${patientId}`, body),
  /** 1-11 환자 이력 */
  history: (patientId: number) => api.get<PatientHistory>(`/api/patients/${patientId}/history`),
  /** 1-12 의료진 등록 */
  createStaff: (body: CreateStaffRequest) => api.post<Staff>("/api/staff", body),
  /** 1-13 의료진 정보 수정 (이름·연락처·직급만) */
  updateStaff: (staffId: number, body: UpdateStaffRequest) => api.patch<Staff>(`/api/staff/${staffId}`, body),
  /** 1-14 진료과 추가·수정·삭제 */
  createDepartment: (body: DepartmentInput) => api.post<Department>("/api/departments", body),
  updateDepartment: (code: string, body: Partial<DepartmentInput>) => api.patch<Department>(`/api/departments/${code}`, body),
  deleteDepartment: (code: string) => api.delete(`/api/departments/${code}`),
};
