/** 결제 표기 (S6, P6 공통). 항목별 금액은 보여 주지 않고 포함 목록만 씁니다. */
import type { Payment } from "@/lib/api/types";
import { shortDate } from "@/lib/date";

/** "10. 28(수) 내과 외래" 또는 입원 청구면 "9. 01(화)~9. 05(토) 내과 입원" */
export function paymentTitle(p: Payment) {
  if (p.admission) {
    const end = p.admission.dischargedAt ? shortDate(p.admission.dischargedAt) : "";
    return `${shortDate(p.admission.admittedAt)}~${end} ${p.departmentName} 입원`;
  }
  return `${shortDate(p.encounterAt)} ${p.departmentName} 외래`;
}

/** "진찰 1회 · 검사 2건(일반혈액검사, CRP) · 원외 처방(약국 계산)" */
export function includesText(p: Payment) {
  const i = p.includes;
  const parts = [`진찰 ${i.consultationCount}회`];
  if (i.examNames.length) parts.push(`검사 ${i.examNames.length}건(${i.examNames.join(", ")})`);
  if (i.inHousePrescriptionCount) parts.push(`원내 처방 ${i.inHousePrescriptionCount}건`);
  if (i.hasOutsidePrescription) parts.push("원외 처방(약국 계산)");
  if (i.roundCount) parts.push(`회진 ${i.roundCount}회`);
  if (i.admissionDays) parts.push(`입원료 ${i.admissionDays}일`);
  return parts.join(" · ");
}
