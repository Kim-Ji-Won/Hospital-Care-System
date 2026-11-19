/** 01 회원 관리 (배성진) — docs/api/01-member.md */
import { api } from "./client";
import type { Department, LoginRequest, PatientDetail, PatientProfile, SessionUser, SignupRequest } from "./types";

/** 쿼리 키 묶음. 화면에서는 배열을 직접 적지 않고 이것만 씁니다. (로그인 정보 키는 lib/auth의 ME_KEY) */
export const memberKeys = {
  all: ["member"] as const,
  profile: () => [...memberKeys.all, "profile"] as const,
  patient: (patientId: number) => [...memberKeys.all, "patient", patientId] as const,
  departments: () => [...memberKeys.all, "departments"] as const,
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
};
