"use client";

/** 환자 화면의 입원 부품 — P1 홈 입원 카드, P1a·P6 청구 안내 (API 5-7) */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { admissionApi, admissionKeys } from "@/lib/api/admission";
import { shortDate } from "@/lib/date";
import { Chip } from "@/components/ui";

/** 입원 중에는 결제가 만들어지지 않으므로 결제 내역이 비어 보이는 이유를 미리 알림 */
export function InpatientNotice() {
  return (
    <div className="rounded-xl border border-sky bg-select-bg px-4 py-3">
      <p className="text-item font-bold text-navy">진료비는 퇴원 후 한 번에 청구됩니다</p>
      <p className="mt-1 text-body text-ink">입원료와 입원 중 검사·처방을 합쳐 결제 내역에 표시돼요.</p>
    </div>
  );
}

/** 지금 입원 중인지 (퇴원일시가 없는 입원) */
export function useCurrentAdmission() {
  const admissions = useQuery({ queryKey: admissionKeys.mine(), queryFn: admissionApi.mine });
  return admissions.data?.find((a) => !a.dischargedAt) ?? null;
}

/** P1 홈 입원 카드: 입원 중일 때만 보이고 P1a로 이어짐 */
export function AdmissionCard() {
  const a = useCurrentAdmission();
  if (!a) return null;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-sky bg-select-bg px-6 py-5">
      <div className="flex flex-col gap-1">
        <Chip>입원 중</Chip>
        <p className="mt-1 text-step font-bold text-ink">
          {a.roomNo}호 · {a.ward}
        </p>
        <p className="text-body text-ink-sub">
          주치의 {a.attendingName} · 입원 {shortDate(a.admittedAt)} · 퇴원 예정 {a.expectedDischargeDate ? shortDate(a.expectedDischargeDate) : "미정"}
        </p>
      </div>
      <Link href="/admission" className="font-semibold text-navy underline underline-offset-4">
        입원 내역 보기
      </Link>
    </div>
  );
}
