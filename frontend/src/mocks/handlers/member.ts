/** 01 회원 관리 목 핸들러 — docs/api/01-member.md 1-1 ~ 1-8 */
import { http, HttpResponse } from "msw";
import type { Department, LoginRequest, PatientDetail, PatientProfile, SignupRequest, Staff } from "@/lib/api/types";
import { db, save, type PatientRow } from "../db";
import { apiError, requireRole, sessionUser, validationError } from "../http";
import { departmentOf, staffOf, toMyReservation } from "../logic";
import { now } from "@/lib/date";

function profileOf(p: PatientRow): PatientProfile {
  return {
    patientId: p.patient_id,
    name: p.name,
    birthDate: p.birth_date,
    gender: p.gender,
    phone: p.phone,
    address: p.address,
    bloodType: p.blood_type,
    loginId: p.login_id ?? "",
  };
}

const LOGIN_ID = /^[A-Za-z0-9]{4,20}$/;
const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;
const PHONE = /^[0-9-]{1,20}$/;

export const memberHandlers = [
  // 1-1 로그인
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as Partial<LoginRequest>;
    if ((body.accountType !== "환자" && body.accountType !== "의료진") || !body.loginId || !body.password) {
      return validationError({ loginId: "아이디와 비밀번호를 입력하세요." });
    }
    const d = db();
    if (body.accountType === "환자") {
      const p = d.patients.find((x) => x.login_id === body.loginId);
      if (!p || p.password !== body.password) return apiError(401, "LOGIN_FAILED", "아이디 또는 비밀번호가 맞지 않습니다.");
      d.session = { accountType: "환자", id: p.patient_id };
    } else {
      const s = d.staff.find((x) => x.login_id === body.loginId);
      if (!s || s.password !== body.password) return apiError(401, "LOGIN_FAILED", "아이디 또는 비밀번호가 맞지 않습니다.");
      d.session = { accountType: "의료진", id: s.staff_id };
    }
    save();
    return HttpResponse.json(sessionUser());
  }),

  // 1-2 로그아웃
  http.post("/api/auth/logout", () => {
    db().session = null;
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  // 1-3 로그인 상태 확인
  http.get("/api/auth/me", () => {
    const user = sessionUser();
    return user ? HttpResponse.json(user) : apiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
  }),

  // 1-4 회원가입
  http.post("/api/auth/signup", async ({ request }) => {
    const b = (await request.json()) as Partial<SignupRequest>;
    const fields: Record<string, string> = {};
    if (!b.name || b.name.length > 50) fields.name = "이름을 50자 이내로 입력하세요.";
    if (!b.birthDate || b.birthDate < "1900-01-01" || b.birthDate >= new Date().toISOString().slice(0, 10)) fields.birthDate = "생년월일을 확인하세요.";
    if (b.gender !== "남" && b.gender !== "여") fields.gender = "성별을 고르세요.";
    if (!b.phone || !PHONE.test(b.phone)) fields.phone = "숫자와 하이픈으로 20자 이내로 입력하세요.";
    if (!b.loginId || !LOGIN_ID.test(b.loginId)) fields.loginId = "영문·숫자 4~20자로 입력하세요.";
    if (!b.password || !PASSWORD.test(b.password)) fields.password = "영문과 숫자를 섞어 8자 이상 입력하세요.";
    if (Object.keys(fields).length > 0) return validationError(fields);

    const d = db();
    if (d.patients.some((p) => p.name === b.name && p.birth_date === b.birthDate && p.phone === b.phone)) {
      return apiError(409, "ALREADY_REGISTERED", "이미 가입된 환자입니다.");
    }
    if (d.patients.some((p) => p.login_id === b.loginId)) {
      return apiError(409, "LOGIN_ID_TAKEN", "이미 쓰는 아이디입니다.");
    }
    const patientId = Math.max(...d.patients.map((p) => p.patient_id)) + 1;
    d.patients.push({
      patient_id: patientId,
      name: b.name!,
      birth_date: b.birthDate!,
      gender: b.gender!,
      phone: b.phone!,
      address: null,
      blood_type: null,
      login_id: b.loginId!,
      password: b.password!,
    });
    d.session = { accountType: "환자", id: patientId };
    save();
    return HttpResponse.json(sessionUser(), { status: 201 });
  }),

  // 1-5 내 정보
  http.get("/api/me/profile", () => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const p = db().patients.find((x) => x.patient_id === user.patientId)!;
    return HttpResponse.json(profileOf(p));
  }),

  // 1-6 환자 정보 (의료진용). 진료·예약·입원 목 데이터가 생기면 요약을 채웁니다.
  http.get("/api/patients/:patientId", ({ params }) => {
    const { deny } = requireRole("의사", "간호사", "원무");
    if (deny) return deny;
    const d = db();
    const p = d.patients.find((x) => x.patient_id === Number(params.patientId));
    if (!p) return apiError(404, "NOT_FOUND", "없는 환자번호입니다.");

    const last = d.encounters.filter((e) => e.patient_id === p.patient_id).sort((a, b) => b.encounter_at.localeCompare(a.encounter_at))[0];
    const primary = last && d.diagnoses.find((x) => x.encounter_id === last.encounter_id && x.is_primary === "Y");
    const next = d.reservations
      .filter((r) => r.patient_id === p.patient_id && r.status === "예약" && r.appointment_at >= now())
      .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at))[0];
    const admission = d.admissions.find(
      (a) => !a.discharged_at && d.encounters.find((e) => e.encounter_id === a.decision_encounter_id)?.patient_id === p.patient_id,
    );
    const nextRes = next ? toMyReservation(next) : null;

    const detail: PatientDetail = {
      ...profileOf(p),
      lastEncounter: last
        ? {
            encounterId: last.encounter_id,
            encounterAt: last.encounter_at,
            encounterType: last.encounter_type,
            departmentName: departmentOf(staffOf(last.doctor_id).department_code)?.name ?? "",
            primaryDiseaseName: primary ? (d.diseases.find((x) => x.disease_code === primary.disease_code)?.name ?? null) : null,
          }
        : null,
      nextReservation: nextRes
        ? { reservationId: nextRes.reservationId, appointmentAt: nextRes.appointmentAt, departmentName: nextRes.departmentName, doctorName: nextRes.doctorName }
        : null,
      currentAdmission: admission
        ? { admissionId: admission.admission_id, roomNo: admission.room_no, ward: d.rooms.find((r) => r.room_no === admission.room_no)?.ward ?? "", admittedAt: admission.admitted_at }
        : null,
    };
    return HttpResponse.json(detail);
  }),

  // 1-7 진료과 목록 (진료과명 가나다순)
  http.get("/api/departments", () => {
    const { deny } = requireRole();
    if (deny) return deny;
    const d = db();
    const list: Department[] = d.departments
      .map((x) => ({
        departmentCode: x.department_code,
        name: x.name,
        location: x.location,
        phone: x.phone,
        staffCount: d.staff.filter((s) => s.department_code === x.department_code).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return HttpResponse.json(list);
  }),

  // 1-8 의료진 목록 (의료진번호 순)
  http.get("/api/staff", ({ request }) => {
    const { deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const q = new URL(request.url).searchParams;
    const jobType = q.get("jobType");
    const departmentCode = q.get("departmentCode");
    if (jobType && !["의사", "간호사", "원무"].includes(jobType)) return validationError({ jobType: "직종은 의사·간호사·원무 중 하나입니다." });
    const list: Staff[] = db()
      .staff.filter((s) => (!jobType || s.job_type === jobType) && (!departmentCode || s.department_code === departmentCode))
      .sort((a, b) => a.staff_id - b.staff_id)
      .map((s) => ({
        staffId: s.staff_id,
        name: s.name,
        jobType: s.job_type,
        position: s.position,
        departmentCode: s.department_code,
        departmentName: departmentOf(s.department_code)?.name ?? null,
        phone: s.phone,
        loginId: s.login_id,
      }));
    return HttpResponse.json(list);
  }),
];
