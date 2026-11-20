/** 06 결제 관리 목 핸들러 — docs/api/06-payment.md 6-1 ~ 6-4 */
import { http, HttpResponse } from "msw";
import type { PaymentMethod } from "@/lib/api/types";
import { now } from "@/lib/date";
import { db, save } from "../db";
import { apiError, requireRole, validationError } from "../http";
import { createPayment, inpatientAmount, outpatientAmount, toPayment } from "../logic";

const METHODS: PaymentMethod[] = ["카드", "현금", "계좌이체"];

function paymentsOfPatient(patientId: number) {
  const d = db();
  return d.payments
    .filter((p) => d.encounters.find((e) => e.encounter_id === p.encounter_id)?.patient_id === patientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toPayment);
}

export const paymentHandlers = [
  // 6-1 환자별 결제 목록
  http.get("/api/payments", ({ request }) => {
    const { deny } = requireRole("원무");
    if (deny) return deny;
    const raw = new URL(request.url).searchParams.get("patientId");
    if (!raw || !/^\d+$/.test(raw)) return validationError({ patientId: "환자번호를 보내세요." });
    const patientId = Number(raw);
    if (!db().patients.some((p) => p.patient_id === patientId)) return apiError(404, "NOT_FOUND", "없는 환자번호입니다.");
    return HttpResponse.json(paymentsOfPatient(patientId));
  }),

  // 6-2 수납: 미결제 → 완료
  http.post("/api/payments/:paymentId/pay", async ({ params, request }) => {
    const { deny } = requireRole("원무");
    if (deny) return deny;
    const { method } = (await request.json()) as { method?: PaymentMethod };
    if (!method || !METHODS.includes(method)) return validationError({ method: "결제수단을 고르세요." });
    const p = db().payments.find((x) => x.payment_id === Number(params.paymentId));
    if (!p) return apiError(404, "NOT_FOUND", "없는 결제번호입니다.");
    if (p.status !== "미결제") return apiError(409, "INVALID_STATUS", "'미결제' 결제만 수납할 수 있습니다.");
    p.status = "완료";
    p.method = method;
    p.paid_at = now();
    save();
    return HttpResponse.json(toPayment(p));
  }),

  // 6-4 결제 취소: 기존 결제를 먼저 '취소'로 바꾼 다음 지금 단가로 다시 계산한 '미결제'를 만듦 (함수형 UNIQUE 순서)
  http.post("/api/payments/:paymentId/cancel", ({ params }) => {
    const { deny } = requireRole("원무");
    if (deny) return deny;
    const d = db();
    const p = d.payments.find((x) => x.payment_id === Number(params.paymentId));
    if (!p) return apiError(404, "NOT_FOUND", "없는 결제번호입니다.");
    if (p.status !== "완료") return apiError(409, "INVALID_STATUS", "'완료' 결제만 취소할 수 있습니다.");
    p.status = "취소"; // 결제수단·결제일시는 그대로 둠
    const admission = d.admissions.find((a) => a.decision_encounter_id === p.encounter_id);
    const amount = admission?.discharged_at ? inpatientAmount(admission, admission.discharged_at) : outpatientAmount(p.encounter_id);
    const created = createPayment(p.encounter_id, amount);
    save();
    return HttpResponse.json({ cancelled: toPayment(p), newPayment: toPayment(created) });
  }),

  // 6-3 내 결제 내역
  http.get("/api/me/payments", () => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    return HttpResponse.json(paymentsOfPatient(user.patientId!));
  }),
];
