"use client";

/**
 * 환자 화면의 입원 부품 — P1 홈 입원 카드, P1·P1a·P6 청구 안내 (API 5-7, 3-2)
 * 입원을 결정한 진료와 회진에는 결제가 바로 생기지 않고 퇴원 때 한 번에 청구됩니다.
 * 그래서 입원 중이거나 병실 배정을 기다리는 환자는 "낼 진료비 없음"으로 보이므로, 그 이유를 같이 보여 줍니다.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { admissionApi, admissionKeys } from "@/lib/api/admission";
import { encounterApi, encounterKeys } from "@/lib/api/encounter";
import type { MyAdmission } from "@/lib/api/types";
import { shortDate } from "@/lib/date";
import { Chip } from "@/components/ui";

export type InpatientState = { kind: "admitted"; admission: MyAdmission } | { kind: "pending" } | null;

/** 입원 중(퇴원일시 없음) 또는 배정 대기(입원 결정 진료에 아직 입원 행이 없음) */
export function useInpatientState(): InpatientState {
  const admissions = useQuery({ queryKey: admissionKeys.mine(), queryFn: admissionApi.mine });
  const encounters = useQuery({ queryKey: encounterKeys.mine(), queryFn: encounterApi.mine });
  if (!admissions.data) return null;
  const current = admissions.data.find((a) => !a.dischargedAt);
  if (current) return { kind: "admitted", admission: current };
  const pending = encounters.data?.some((e) => e.admissionDecided && !admissions.data.some((a) => a.decisionEncounterId === e.encounterId));
  return pending ? { kind: "pending" } : null;
}

const NOTICE = {
  admitted: { title: "진료비는 퇴원 후 한 번에 청구됩니다", body: "입원료와 입원 중 검사·처방을 합쳐 결제 내역에 표시돼요." },
  pending: { title: "입원이 결정되어 병실 배정을 기다리고 있어요", body: "입원을 결정한 날의 진료비도 따로 청구되지 않고, 퇴원할 때 입원 진료비에 합쳐 한 번에 청구돼요." },
};

/** 결제 내역이 비어 보이는 이유를 미리 알림 */
export function InpatientNotice({ kind }: { kind: "admitted" | "pending" }) {
  return (
    <div className="rounded-xl border border-sky bg-select-bg px-4 py-3">
      <p className="text-item font-bold text-navy">{NOTICE[kind].title}</p>
      <p className="mt-1 text-body text-ink">{NOTICE[kind].body}</p>
    </div>
  );
}

/** P1 미결제 카드 안의 짧은 안내 */
export function inpatientBillingLine(state: InpatientState) {
  if (!state) return null;
  return state.kind === "admitted" ? "입원 진료비는 퇴원 후 한 번에 청구돼요." : "입원이 결정되어, 진료비는 퇴원할 때 한 번에 청구돼요.";
}

/** P1 홈 입원 카드: 입원 중이거나 배정 대기일 때만 보이고 P1a로 이어짐 */
export function AdmissionCard({ state }: { state: InpatientState }) {
  if (!state) return null;
  if (state.kind === "pending") {
    return (
      <div className="flex flex-col gap-1 rounded-2xl border border-sky bg-select-bg px-6 py-5">
        <div>
          <Chip>입원 결정</Chip>
        </div>
        <p className="mt-1 text-step font-bold text-ink">병실 배정을 기다리고 있어요</p>
        <p className="text-body text-ink-sub">병실과 주치의가 정해지면 여기에 표시돼요.</p>
      </div>
    );
  }
  const a = state.admission;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-sky bg-select-bg px-6 py-5">
      <div className="flex flex-col gap-1">
        <div>
          <Chip>입원 중</Chip>
        </div>
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
