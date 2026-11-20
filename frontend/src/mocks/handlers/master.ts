/**
 * 기준 정보 추가·수정·삭제 목 핸들러 (S8)
 * 01 회원 1-12 ~ 1-14, 04 처방·검사 4-8 ~ 4-10, 05 입·퇴원 5-8. 영역마다 따로 내보내 browser.ts에서 그 영역에 붙입니다.
 * 코드(PK)는 만든 뒤 잠그고, 참조 중인 행은 지우지 않고 사용 건수를 돌려줍니다(ON DELETE RESTRICT).
 */
import { http, HttpResponse } from "msw";
import type { CreateStaffRequest, DepartmentInput, DiseaseInput, DrugInput, ExamItemInput, RoomInput, UpdateStaffRequest } from "@/lib/api/types";
import { db, save } from "../db";
import { apiError, requireRole, validationError } from "../http";
import { departmentOf, occupiedBeds } from "../logic";

const STAFF = ["의사", "간호사"] as const;
const len = (v: unknown, min: number, max: number) => typeof v === "string" && v.trim().length >= min && v.length <= max;
const optLen = (v: unknown, max: number) => v == null || (typeof v === "string" && v.length <= max);
const nonNegInt = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
const PHONE = /^[\d-]{1,20}$/;
const deny = () => requireRole(...STAFF).deny;
const fail = (f: Record<string, string>) => (Object.keys(f).length ? validationError(f) : null);

// ---------- 01: 의료진(1-12, 1-13), 진료과(1-14) ----------

function staffJson(staffId: number) {
  const s = db().staff.find((x) => x.staff_id === staffId)!;
  return {
    staffId: s.staff_id,
    name: s.name,
    jobType: s.job_type,
    position: s.position,
    departmentCode: s.department_code,
    departmentName: departmentOf(s.department_code)?.name ?? null,
    phone: s.phone,
    loginId: s.login_id,
  };
}

function departmentJson(code: string) {
  const d = db();
  const x = d.departments.find((y) => y.department_code === code)!;
  return { departmentCode: x.department_code, name: x.name, location: x.location, phone: x.phone, staffCount: d.staff.filter((s) => s.department_code === code).length };
}

export const memberMasterHandlers = [
  // 1-12 의료진 등록
  http.post("/api/staff", async ({ request }) => {
    const no = deny();
    if (no) return no;
    const b = (await request.json()) as Partial<CreateStaffRequest>;
    const d = db();
    const f: Record<string, string> = {};
    if (!len(b.name, 1, 50)) f.name = "이름은 1~50자입니다.";
    if (!b.phone || !PHONE.test(b.phone)) f.phone = "연락처는 숫자와 하이픈만 20자 이내입니다.";
    if (!b.jobType || !["의사", "간호사", "원무"].includes(b.jobType)) f.jobType = "직종을 고르세요.";
    if (!optLen(b.position, 20)) f.position = "직급은 20자 이내입니다.";
    if (b.jobType === "원무" && b.departmentCode) f.departmentCode = "원무는 진료과가 없습니다.";
    if (b.jobType && b.jobType !== "원무" && !departmentOf(b.departmentCode ?? null)) f.departmentCode = "의사·간호사는 진료과를 골라야 합니다.";
    if (!b.loginId || !/^[A-Za-z0-9]{4,20}$/.test(b.loginId)) f.loginId = "아이디는 영문·숫자 4~20자입니다.";
    if (!b.password || !/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/.test(b.password)) f.password = "비밀번호는 영문과 숫자를 모두 넣어 8~64자입니다.";
    const bad = fail(f);
    if (bad) return bad;
    const taken = d.staff.find((s) => s.login_id === b.loginId);
    if (taken) return apiError(409, "LOGIN_ID_TAKEN", "다른 의료진이 쓰는 아이디입니다.", { details: { staffId: taken.staff_id, name: taken.name } });
    const staffId = d.staff.reduce((m, s) => Math.max(m, s.staff_id), 0) + 1;
    d.staff.push({
      staff_id: staffId,
      department_code: b.jobType === "원무" ? null : b.departmentCode!,
      name: b.name!.trim(),
      phone: b.phone!,
      job_type: b.jobType!,
      position: b.position?.trim() || null,
      login_id: b.loginId!,
      password: b.password!, // 목 서버라 평문. 실제 백엔드는 BCrypt 해시
    });
    save();
    return HttpResponse.json(staffJson(staffId), { status: 201 });
  }),

  // 1-13 의료진 정보 수정: 이름·연락처·직급만 (직종·진료과·아이디는 잠금, 삭제 없음)
  http.patch("/api/staff/:staffId", async ({ params, request }) => {
    const no = deny();
    if (no) return no;
    const s = db().staff.find((x) => x.staff_id === Number(params.staffId));
    if (!s) return apiError(404, "NOT_FOUND", "없는 의료진입니다.");
    const b = (await request.json()) as UpdateStaffRequest & Record<string, unknown>;
    const f: Record<string, string> = {};
    if (["jobType", "departmentCode", "loginId"].some((k) => b[k] !== undefined)) f.jobType = "직종·진료과·아이디는 고칠 수 없습니다.";
    if (b.name !== undefined && !len(b.name, 1, 50)) f.name = "이름은 1~50자입니다.";
    if (b.phone !== undefined && !PHONE.test(b.phone ?? "")) f.phone = "연락처는 숫자와 하이픈만 20자 이내입니다.";
    if (!optLen(b.position, 20)) f.position = "직급은 20자 이내입니다.";
    const bad = fail(f);
    if (bad) return bad;
    if (b.name !== undefined) s.name = b.name.trim();
    if (b.phone !== undefined) s.phone = b.phone;
    if (b.position !== undefined) s.position = b.position?.trim() || null;
    save();
    return HttpResponse.json(staffJson(s.staff_id));
  }),

  // 1-14 진료과 추가
  http.post("/api/departments", async ({ request }) => {
    const no = deny();
    if (no) return no;
    const b = (await request.json()) as Partial<DepartmentInput>;
    const f: Record<string, string> = {};
    if (!b.departmentCode || !/^[A-Z0-9]{1,10}$/.test(b.departmentCode)) f.departmentCode = "코드는 영문 대문자·숫자 1~10자입니다.";
    if (!len(b.name, 1, 50)) f.name = "진료과명은 1~50자입니다.";
    if (!optLen(b.location, 100)) f.location = "위치는 100자 이내입니다.";
    if (!optLen(b.phone, 20)) f.phone = "전화는 20자 이내입니다.";
    const bad = fail(f);
    if (bad) return bad;
    const d = db();
    if (d.departments.some((x) => x.department_code === b.departmentCode)) return apiError(409, "CODE_TAKEN", "같은 진료과코드가 있습니다.");
    d.departments.push({ department_code: b.departmentCode!, name: b.name!.trim(), location: b.location?.trim() || null, phone: b.phone?.trim() || null });
    save();
    return HttpResponse.json(departmentJson(b.departmentCode!), { status: 201 });
  }),

  // 1-14 진료과 수정 (코드는 잠금)
  http.patch("/api/departments/:code", async ({ params, request }) => {
    const no = deny();
    if (no) return no;
    const x = db().departments.find((y) => y.department_code === params.code);
    if (!x) return apiError(404, "NOT_FOUND", "없는 진료과코드입니다.");
    const b = (await request.json()) as Partial<DepartmentInput>;
    const f: Record<string, string> = {};
    if (b.departmentCode !== undefined) f.departmentCode = "진료과코드는 고칠 수 없습니다.";
    if (b.name !== undefined && !len(b.name, 1, 50)) f.name = "진료과명은 1~50자입니다.";
    if (!optLen(b.location, 100)) f.location = "위치는 100자 이내입니다.";
    if (!optLen(b.phone, 20)) f.phone = "전화는 20자 이내입니다.";
    const bad = fail(f);
    if (bad) return bad;
    if (b.name !== undefined) x.name = b.name.trim();
    if (b.location !== undefined) x.location = b.location?.trim() || null;
    if (b.phone !== undefined) x.phone = b.phone?.trim() || null;
    save();
    return HttpResponse.json(departmentJson(x.department_code));
  }),

  // 1-14 진료과 삭제: 소속 의료진이 있으면 IN_USE
  http.delete("/api/departments/:code", ({ params }) => {
    const no = deny();
    if (no) return no;
    const d = db();
    if (!d.departments.some((y) => y.department_code === params.code)) return apiError(404, "NOT_FOUND", "없는 진료과코드입니다.");
    const count = d.staff.filter((s) => s.department_code === params.code).length;
    if (count) return apiError(409, "IN_USE", "소속 의료진이 있습니다.", { details: { count } });
    d.departments = d.departments.filter((y) => y.department_code !== params.code);
    save();
    return new HttpResponse(null, { status: 204 });
  }),
];

// ---------- 04: 질병(4-8), 약품(4-9), 검사항목(4-10) ----------

export const orderMasterHandlers = [
  http.post("/api/diseases", async ({ request }) => {
    const no = deny();
    if (no) return no;
    const b = (await request.json()) as Partial<DiseaseInput>;
    const f: Record<string, string> = {};
    if (!b.diseaseCode || !/^[A-Za-z0-9.]{1,10}$/.test(b.diseaseCode)) f.diseaseCode = "코드는 영문·숫자·점 1~10자입니다.";
    if (!len(b.name, 1, 100)) f.name = "질병명은 1~100자입니다.";
    const bad = fail(f);
    if (bad) return bad;
    const d = db();
    if (d.diseases.some((x) => x.disease_code === b.diseaseCode)) return apiError(409, "CODE_TAKEN", "같은 질병코드가 있습니다.");
    d.diseases.push({ disease_code: b.diseaseCode!, name: b.name!.trim() });
    save();
    return HttpResponse.json({ diseaseCode: b.diseaseCode, name: b.name!.trim(), usageCount: 0 }, { status: 201 });
  }),
  http.patch("/api/diseases/:code", async ({ params, request }) => {
    const no = deny();
    if (no) return no;
    const d = db();
    const x = d.diseases.find((y) => y.disease_code === params.code);
    if (!x) return apiError(404, "NOT_FOUND", "없는 질병코드입니다.");
    const b = (await request.json()) as Partial<DiseaseInput>;
    if (b.diseaseCode !== undefined) return validationError({ diseaseCode: "질병코드는 고칠 수 없습니다." });
    if (b.name !== undefined && !len(b.name, 1, 100)) return validationError({ name: "질병명은 1~100자입니다." });
    if (b.name !== undefined) x.name = b.name.trim();
    save();
    return HttpResponse.json({ diseaseCode: x.disease_code, name: x.name, usageCount: d.diagnoses.filter((y) => y.disease_code === x.disease_code).length });
  }),
  http.delete("/api/diseases/:code", ({ params }) => {
    const no = deny();
    if (no) return no;
    const d = db();
    if (!d.diseases.some((y) => y.disease_code === params.code)) return apiError(404, "NOT_FOUND", "없는 질병코드입니다.");
    const count = d.diagnoses.filter((y) => y.disease_code === params.code).length;
    if (count) return apiError(409, "IN_USE", "진단에 쓰인 질병입니다.", { details: { count } });
    d.diseases = d.diseases.filter((y) => y.disease_code !== params.code);
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/drugs", async ({ request }) => {
    const no = deny();
    if (no) return no;
    const b = (await request.json()) as Partial<DrugInput>;
    const f = drugFields(b, true);
    const bad = fail(f);
    if (bad) return bad;
    const d = db();
    if (d.drugs.some((x) => x.drug_code === b.drugCode)) return apiError(409, "CODE_TAKEN", "같은 약품코드가 있습니다.");
    d.drugs.push({ drug_code: b.drugCode!, name: b.name!.trim(), ingredient: b.ingredient?.trim() || null, form: b.form!.trim(), unit: b.unit!.trim(), unit_price: b.unitPrice! });
    save();
    return HttpResponse.json(b, { status: 201 });
  }),
  http.patch("/api/drugs/:code", async ({ params, request }) => {
    const no = deny();
    if (no) return no;
    const x = db().drugs.find((y) => y.drug_code === params.code);
    if (!x) return apiError(404, "NOT_FOUND", "없는 약품코드입니다.");
    const b = (await request.json()) as Partial<DrugInput>;
    const f = drugFields(b, false);
    if (b.drugCode !== undefined) f.drugCode = "약품코드는 고칠 수 없습니다.";
    const bad = fail(f);
    if (bad) return bad;
    if (b.name !== undefined) x.name = b.name.trim();
    if (b.ingredient !== undefined) x.ingredient = b.ingredient?.trim() || null;
    if (b.form !== undefined) x.form = b.form.trim();
    if (b.unit !== undefined) x.unit = b.unit.trim();
    if (b.unitPrice !== undefined) x.unit_price = b.unitPrice; // 그 뒤에 만드는 청구부터 적용
    save();
    return HttpResponse.json({ drugCode: x.drug_code, name: x.name, ingredient: x.ingredient, form: x.form, unit: x.unit, unitPrice: x.unit_price });
  }),
  http.delete("/api/drugs/:code", ({ params }) => {
    const no = deny();
    if (no) return no;
    const d = db();
    if (!d.drugs.some((y) => y.drug_code === params.code)) return apiError(404, "NOT_FOUND", "없는 약품코드입니다.");
    const count = d.prescriptionItems.filter((y) => y.drug_code === params.code).length;
    if (count) return apiError(409, "IN_USE", "처방에 쓰인 약품입니다.", { details: { count } });
    d.drugs = d.drugs.filter((y) => y.drug_code !== params.code);
    save();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/exam-items", async ({ request }) => {
    const no = deny();
    if (no) return no;
    const b = (await request.json()) as Partial<ExamItemInput>;
    const f = examFields(b, true);
    const bad = fail(f);
    if (bad) return bad;
    const d = db();
    if (d.examItems.some((x) => x.exam_code === b.examCode)) return apiError(409, "CODE_TAKEN", "같은 검사코드가 있습니다.");
    d.examItems.push({ exam_code: b.examCode!, name: b.name!.trim(), category: b.category!, reference_range: b.referenceRange?.trim() || null, unit: b.unit?.trim() || null, fee: b.fee! });
    save();
    return HttpResponse.json(b, { status: 201 });
  }),
  http.patch("/api/exam-items/:code", async ({ params, request }) => {
    const no = deny();
    if (no) return no;
    const x = db().examItems.find((y) => y.exam_code === params.code);
    if (!x) return apiError(404, "NOT_FOUND", "없는 검사코드입니다.");
    const b = (await request.json()) as Partial<ExamItemInput>;
    const merged = { category: b.category ?? x.category, referenceRange: b.referenceRange !== undefined ? b.referenceRange : x.reference_range, unit: b.unit !== undefined ? b.unit : x.unit };
    const f = examFields({ ...b, ...merged }, false);
    if (b.examCode !== undefined) f.examCode = "검사코드는 고칠 수 없습니다.";
    const bad = fail(f);
    if (bad) return bad;
    if (b.name !== undefined) x.name = b.name.trim();
    x.category = merged.category;
    x.reference_range = merged.referenceRange?.trim() || null;
    x.unit = merged.unit?.trim() || null;
    if (b.fee !== undefined) x.fee = b.fee;
    save();
    return HttpResponse.json({ examCode: x.exam_code, name: x.name, category: x.category, referenceRange: x.reference_range, unit: x.unit, fee: x.fee });
  }),
  http.delete("/api/exam-items/:code", ({ params }) => {
    const no = deny();
    if (no) return no;
    const d = db();
    if (!d.examItems.some((y) => y.exam_code === params.code)) return apiError(404, "NOT_FOUND", "없는 검사코드입니다.");
    const count = d.exams.filter((y) => y.exam_code === params.code).length;
    if (count) return apiError(409, "IN_USE", "검사에 쓰인 항목입니다.", { details: { count } });
    d.examItems = d.examItems.filter((y) => y.exam_code !== params.code);
    save();
    return new HttpResponse(null, { status: 204 });
  }),
];

function drugFields(b: Partial<DrugInput>, creating: boolean) {
  const f: Record<string, string> = {};
  if (creating && (!b.drugCode || !len(b.drugCode, 1, 10))) f.drugCode = "약품코드는 1~10자입니다.";
  if ((creating || b.name !== undefined) && !len(b.name, 1, 100)) f.name = "약품명은 1~100자입니다.";
  if (!optLen(b.ingredient, 100)) f.ingredient = "성분은 100자 이내입니다.";
  if ((creating || b.form !== undefined) && !len(b.form, 1, 20)) f.form = "제형은 1~20자입니다.";
  if ((creating || b.unit !== undefined) && !len(b.unit, 1, 20)) f.unit = "단위는 1~20자입니다.";
  if ((creating || b.unitPrice !== undefined) && !nonNegInt(b.unitPrice)) f.unitPrice = "단가는 0 이상 정수(원)입니다.";
  return f;
}

function examFields(b: Partial<ExamItemInput>, creating: boolean) {
  const f: Record<string, string> = {};
  if (creating && (!b.examCode || !len(b.examCode, 1, 10))) f.examCode = "검사코드는 1~10자입니다.";
  if ((creating || b.name !== undefined) && !len(b.name, 1, 100)) f.name = "검사명은 1~100자입니다.";
  if (!b.category || !["혈액", "영상", "기능"].includes(b.category)) f.category = "분류를 고르세요.";
  // 영상·기능은 수치 결과가 없으므로 참고치·단위가 없어야 함
  if (b.category !== "혈액" && (b.referenceRange || b.unit)) f.referenceRange = "영상·기능 검사는 참고치와 단위를 비워야 합니다.";
  if (!optLen(b.referenceRange, 50)) f.referenceRange = "참고치는 50자 이내입니다.";
  if (!optLen(b.unit, 20)) f.unit = "단위는 20자 이내입니다.";
  if ((creating || b.fee !== undefined) && !nonNegInt(b.fee)) f.fee = "검사비는 0 이상 정수(원)입니다.";
  return f;
}

// ---------- 05: 병실(5-8) ----------

const roomJson = (roomNo: number) => {
  const r = db().rooms.find((x) => x.room_no === roomNo)!;
  return { roomNo: r.room_no, ward: r.ward, bedCount: r.bed_count, occupiedBeds: occupiedBeds(r.room_no), dailyFee: r.daily_fee };
};

export const admissionMasterHandlers = [
  http.post("/api/rooms", async ({ request }) => {
    const no = deny();
    if (no) return no;
    const b = (await request.json()) as Partial<RoomInput>;
    const f: Record<string, string> = {};
    if (!Number.isInteger(b.roomNo) || b.roomNo! < 1) f.roomNo = "병실번호는 1 이상 정수입니다.";
    if (!len(b.ward, 1, 20)) f.ward = "병동은 1~20자입니다.";
    if (!Number.isInteger(b.bedCount) || b.bedCount! < 1) f.bedCount = "병상수는 1 이상 정수입니다.";
    if (!nonNegInt(b.dailyFee)) f.dailyFee = "입원료는 0 이상 정수(원)입니다.";
    const bad = fail(f);
    if (bad) return bad;
    const d = db();
    if (d.rooms.some((x) => x.room_no === b.roomNo)) return apiError(409, "CODE_TAKEN", "같은 병실번호가 있습니다.");
    d.rooms.push({ room_no: b.roomNo!, ward: b.ward!.trim(), bed_count: b.bedCount!, daily_fee: b.dailyFee! });
    save();
    return HttpResponse.json(roomJson(b.roomNo!), { status: 201 });
  }),
  http.patch("/api/rooms/:roomNo", async ({ params, request }) => {
    const no = deny();
    if (no) return no;
    const r = db().rooms.find((x) => x.room_no === Number(params.roomNo));
    if (!r) return apiError(404, "NOT_FOUND", "없는 병실번호입니다.");
    const b = (await request.json()) as Partial<RoomInput>;
    const f: Record<string, string> = {};
    if (b.roomNo !== undefined) f.roomNo = "병실번호는 고칠 수 없습니다.";
    if (b.ward !== undefined && !len(b.ward, 1, 20)) f.ward = "병동은 1~20자입니다.";
    if (b.bedCount !== undefined && (!Number.isInteger(b.bedCount) || b.bedCount < 1)) f.bedCount = "병상수는 1 이상 정수입니다.";
    if (b.dailyFee !== undefined && !nonNegInt(b.dailyFee)) f.dailyFee = "입원료는 0 이상 정수(원)입니다.";
    const bad = fail(f);
    if (bad) return bad;
    const occupied = occupiedBeds(r.room_no);
    if (b.bedCount !== undefined && b.bedCount < occupied) return apiError(409, "BED_COUNT_TOO_LOW", "입원 중 인원보다 적게 줄일 수 없습니다.", { details: { occupiedBeds: occupied } });
    if (b.ward !== undefined) r.ward = b.ward.trim();
    if (b.bedCount !== undefined) r.bed_count = b.bedCount;
    if (b.dailyFee !== undefined) r.daily_fee = b.dailyFee; // 그 뒤에 만드는 청구부터 적용
    save();
    return HttpResponse.json(roomJson(r.room_no));
  }),
  http.delete("/api/rooms/:roomNo", ({ params }) => {
    const no = deny();
    if (no) return no;
    const d = db();
    const roomNo = Number(params.roomNo);
    if (!d.rooms.some((x) => x.room_no === roomNo)) return apiError(404, "NOT_FOUND", "없는 병실번호입니다.");
    const count = d.admissions.filter((a) => a.room_no === roomNo).length;
    if (count) return apiError(409, "IN_USE", "입원 기록이 있는 병실입니다.", { details: { count } });
    d.rooms = d.rooms.filter((x) => x.room_no !== roomNo);
    save();
    return new HttpResponse(null, { status: 204 });
  }),
];
