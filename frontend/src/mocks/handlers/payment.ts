/** 06 결제 관리 목 핸들러 — docs/api/06-payment.md 6-1 ~ 6-3 */
import { http, HttpResponse } from "msw";
import type { PaymentMethod } from "@/lib/api/types";
import { now } from "@/lib/date";
import { db, save } from "../db";
import { apiError, requireRole, validationError } from "../http";
import { toPayment } from "../logic";

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

  // 6-3 내 결제 내역
  http.get("/api/me/payments", () => {
    const { user, deny } = requireRole("환자");
    if (deny) return deny;
    return HttpResponse.json(paymentsOfPatient(user.patientId!));
  }),
];
