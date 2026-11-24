/** 06 결제 관리 (김지원) — docs/api/06-payment.md */
import { api } from "./client";
import type { CancelPaymentResponse, Payment, PaymentMethod } from "./types";

export const paymentKeys = {
  all: ["payment"] as const,
  byPatient: (patientId: number) => [...paymentKeys.all, "patient", patientId] as const,
  mine: () => [...paymentKeys.all, "mine"] as const,
};

export const paymentApi = {
  /** 6-1 환자별 결제 목록 */
  byPatient: (patientId: number) => api.get<Payment[]>("/api/payments", { patientId }),
  /** 6-2 수납 */
  pay: (paymentId: number, method: PaymentMethod) => api.post<Payment>(`/api/payments/${paymentId}/pay`, { method }),
  /** 6-3 내 결제 내역 */
  mine: () => api.get<Payment[]>("/api/me/payments"),
  /** 6-4 결제 취소: '완료' → '취소', 같은 진료에 새 '미결제' */
  cancel: (paymentId: number) => api.post<CancelPaymentResponse>(`/api/payments/${paymentId}/cancel`),
};
