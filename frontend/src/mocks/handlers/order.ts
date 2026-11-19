/** 04 처방·검사 관리 목 핸들러 — docs/api/04-order.md 4-1 ~ 4-7 */
import { http, HttpResponse } from "msw";
import type { CompleteExamRequest, ExamStatus, MyExam } from "@/lib/api/types";
import { now } from "@/lib/date";
import { db, save } from "../db";
import { apiError, requireRole, validationError } from "../http";
import { staffOf, toExam } from "../logic";

const STATUSES: ExamStatus[] = ["요청", "시행", "완료"];

export const orderHandlers = [
  // 4-1 검사 목록: 로그인한 의료진의 진료과에서 요청된 검사
  http.get("/api/exams", ({ request }) => {
    const { user, deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const status = new URL(request.url).searchParams.get("status");
    if (status && !STATUSES.includes(status as ExamStatus)) return validationError({ status: "요청, 시행, 완료 중 하나로 보내세요." });
    const d = db();
    const list = d.exams
      .filter((x) => {
        const e = d.encounters.find((y) => y.encounter_id === x.encounter_id)!;
        return staffOf(e.doctor_id).department_code === user.departmentCode && (!status || x.status === status);
      })
      .sort((a, b) => a.requested_at.localeCompare(b.requested_at))
      .map(toExam);
    return HttpResponse.json(list);
  }),

  // 4-2 검사 시행 처리
  http.post("/api/exams/:examId/perform", ({ params }) => {
    const { deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const x = db().exams.find((y) => y.exam_id === Number(params.examId));
    if (!x) return apiError(404, "NOT_FOUND", "없는 검사번호입니다.");
    if (x.status !== "요청") return apiError(409, "INVALID_STATUS", "'요청' 상태인 검사만 시행할 수 있습니다.");
    x.status = "시행";
    x.performed_at = now();
    save();
    return HttpResponse.json(toExam(x));
  }),

  // 4-3 검사 결과·판독 입력
  http.post("/api/exams/:examId/complete", async ({ params, request }) => {
    const { user, deny } = requireRole("의사");
    if (deny) return deny;
    const d = db();
    const x = d.exams.find((y) => y.exam_id === Number(params.examId));
    if (!x) return apiError(404, "NOT_FOUND", "없는 검사번호입니다.");
    if (x.status !== "시행") {
      return apiError(409, "INVALID_STATUS", "'시행' 상태인 검사만 완료할 수 있습니다.", {
        details: x.status === "완료" && x.reader_id ? { readerName: staffOf(x.reader_id).name } : null,
      });
    }
    const b = (await request.json()) as Partial<CompleteExamRequest>;
    const item = d.examItems.find((i) => i.exam_code === x.exam_code)!;
    const f: Record<string, string> = {};
    if (b.resultFlag !== "정상" && b.resultFlag !== "이상") f.resultFlag = "판정을 고르세요.";
    if (!b.readingNote?.trim() || b.readingNote.length > 2000) f.readingNote = "판독 소견을 2,000자 이내로 입력하세요.";
    if (item.category !== "혈액" && b.resultValue != null) f.resultValue = "영상·기능 검사는 결과값을 넣지 않습니다.";
    if (b.resultValue != null && (Math.abs(b.resultValue) > 99999999.99 || Number.isNaN(b.resultValue))) f.resultValue = "결과값이 범위를 벗어났습니다.";
    if (Object.keys(f).length > 0) return validationError(f);
    x.status = "완료";
    x.result_value = b.resultValue ?? null;
    x.result_flag = b.resultFlag!;
    x.reading_note = b.readingNote!.trim();
    x.reader_id = user.staffId;
    save();
    return HttpResponse.json(toExam(x));
  }),

  // 4-4 내 검사 결과 ('완료'만, 시행일시 내림차순)
  http.get("/api/me/exams", () => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    const d = db();
    const list: MyExam[] = d.exams
      .filter((x) => x.status === "완료" && d.encounters.find((e) => e.encounter_id === x.encounter_id)?.patient_id === user.patientId)
      .sort((a, b) => (b.performed_at ?? "").localeCompare(a.performed_at ?? ""))
      .map((x) => {
        const item = d.examItems.find((i) => i.exam_code === x.exam_code)!;
        const e = d.encounters.find((y) => y.encounter_id === x.encounter_id)!;
        return {
          examId: x.exam_id,
          examCode: x.exam_code,
          examName: item.name,
          category: item.category,
          referenceRange: item.reference_range,
          unit: item.unit,
          resultValue: x.result_value,
          resultFlag: x.result_flag!,
          readingNote: x.reading_note!,
          readerName: staffOf(x.reader_id!).name,
          performedAt: x.performed_at!,
          encounterId: x.encounter_id,
          encounterAt: e.encounter_at,
        };
      });
    return HttpResponse.json(list);
  }),

  // 4-5 질병 검색
  http.get("/api/diseases", ({ request }) => {
    const { deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
    const d = db();
    const list = d.diseases
      .filter((x) => !q || x.disease_code.toLowerCase().startsWith(q) || x.name.includes(q))
      .sort((a, b) => a.disease_code.localeCompare(b.disease_code))
      .map((x) => ({ diseaseCode: x.disease_code, name: x.name, usageCount: d.diagnoses.filter((y) => y.disease_code === x.disease_code).length }));
    return HttpResponse.json(list);
  }),

  // 4-6 약품 검색
  http.get("/api/drugs", ({ request }) => {
    const { deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
    const list = db()
      .drugs.filter((x) => !q || x.name.toLowerCase().includes(q) || x.drug_code.toLowerCase().includes(q) || (x.ingredient ?? "").includes(q))
      .sort((a, b) => a.drug_code.localeCompare(b.drug_code))
      .map((x) => ({ drugCode: x.drug_code, name: x.name, ingredient: x.ingredient, form: x.form, unit: x.unit, unitPrice: x.unit_price }));
    return HttpResponse.json(list);
  }),

  // 4-7 검사항목 검색
  http.get("/api/exam-items", ({ request }) => {
    const { deny } = requireRole("의사", "간호사");
    if (deny) return deny;
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
    const list = db()
      .examItems.filter((x) => !q || x.name.toLowerCase().includes(q) || x.exam_code.toLowerCase().includes(q))
      .sort((a, b) => a.exam_code.localeCompare(b.exam_code))
      .map((x) => ({ examCode: x.exam_code, name: x.name, category: x.category, referenceRange: x.reference_range, unit: x.unit, fee: x.fee }));
    return HttpResponse.json(list);
  }),
];
