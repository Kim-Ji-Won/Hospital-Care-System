/** 목 핸들러 공통 도구: 오류 응답, 로그인 사용자 확인 */
import { HttpResponse } from "msw";
import type { ApiErrorBody, Role, SessionUser } from "@/lib/api/types";
import { db } from "./db";

export function apiError(status: number, code: string, message: string, extra: Partial<ApiErrorBody> = {}) {
  const body: ApiErrorBody = { code, message, fields: null, details: null, ...extra };
  return HttpResponse.json(body, { status });
}

export function validationError(fields: Record<string, string>) {
  return apiError(400, "VALIDATION_FAILED", "입력값을 확인하세요.", {
    fields: Object.entries(fields).map(([field, reason]) => ({ field, reason })),
  });
}

export function sessionUser(): SessionUser | null {
  const d = db();
  const s = d.session;
  if (!s) return null;
  if (s.accountType === "환자") {
    const p = d.patients.find((x) => x.patient_id === s.id);
    if (!p) return null;
    return { role: "환자", patientId: p.patient_id, staffId: null, loginId: p.login_id ?? "", name: p.name, position: null, departmentCode: null, departmentName: null };
  }
  const st = d.staff.find((x) => x.staff_id === s.id);
  if (!st) return null;
  const dept = d.departments.find((x) => x.department_code === st.department_code);
  return {
    role: st.job_type,
    patientId: null,
    staffId: st.staff_id,
    loginId: st.login_id,
    name: st.name,
    position: st.position,
    departmentCode: st.department_code,
    departmentName: dept?.name ?? null,
  };
}

/** README 2. 인증과 권한: 로그인 안 했으면 401, 직종이 다르면 403 */
export function requireRole(...roles: Role[]): { user: SessionUser; deny?: undefined } | { user?: undefined; deny: Response } {
  const user = sessionUser();
  if (!user) return { deny: apiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.") };
  if (roles.length > 0 && !roles.includes(user.role)) return { deny: apiError(403, "FORBIDDEN", "권한이 없습니다.") };
  return { user };
}
