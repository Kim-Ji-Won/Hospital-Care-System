"use client";

/**
 * S5b 퇴원 처리 — API 5-4, 5-5, 5-6
 * 오늘 퇴원 예정 환자를 고르고(입원·병실 화면에서 다른 환자를 골라 들어올 수도 있음) 퇴원 일시만 정합니다.
 * 퇴원 처리가 곧 입원 통합 청구('미결제') 생성 시점이라, 회진·검사·원내 처방 건수를 먼저 확인하게 합니다.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admissionApi, admissionKeys } from "@/lib/api/admission";
import { ApiError } from "@/lib/api/client";
import { memberKeys } from "@/lib/api/member";
import { paymentKeys } from "@/lib/api/payment";
import type { Admission, AdmissionDetail, DischargeResponse } from "@/lib/api/types";
import { daysBetween, fromInputDateTime, now, shortDate, shortDateTime, toInputDateTime, today, won } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, cx, selectableRow } from "@/components/ui";

export default function DischargePage() {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <Discharge />
    </Suspense>
  );
}

function Discharge() {
  const fromList = Number(useSearchParams().get("admissionId")) || null;
  const admissions = useQuery({ queryKey: admissionKeys.list(), queryFn: () => admissionApi.list() });
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState<DischargeResponse | null>(null);

  return (
    <>
      <PageHeader title="퇴원 처리" />
      {done && <DoneBanner result={done} />}
      <QueryView
        query={admissions}
        skeletonRows={4}
        errorTitle="입원 중인 환자를 불러오지 못했습니다"
        isEmpty={(list) => !fromList && !list.some((a) => a.expectedDischargeDate === today())}
        empty={{
          title: "오늘 퇴원 예정인 환자가 없습니다",
          description: "예정일이 다르거나 정해지지 않은 환자는 입원·병실 화면의 입원 중 표에서 퇴원 처리할 수 있습니다.",
          action: <Link href="/staff/admissions" className="font-semibold text-navy underline underline-offset-4">입원 중 환자 보기</Link>,
        }}
      >
        {(list) => {
          const dueToday = list.filter((a) => a.expectedDischargeDate === today());
          const selectedId = picked ?? fromList ?? dueToday[0]?.admissionId ?? null;
          return (
            <div className="grid grid-cols-[1fr_340px] gap-6">
              <DueTodayTable list={dueToday} selectedId={selectedId} onSelect={setPicked} />
              {selectedId ? (
                <DischargePanel key={selectedId} admissionId={selectedId} onDone={setDone} />
              ) : (
                <div className="rounded-xl border border-dashed border-sky bg-white p-6 text-center text-body text-ink-sub">목록에서 환자를 고르세요.</div>
              )}
            </div>
          );
        }}
      </QueryView>
    </>
  );
}

function DueTodayTable({ list, selectedId, onSelect }: { list: Admission[]; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <section className="self-start">
      <h2 className="mb-2 text-body font-bold text-ink-sub">오늘 퇴원 예정</h2>
      {list.length === 0 ? (
        <p className="rounded-xl border border-sky bg-white px-5 py-4 text-body text-ink-sub">오늘 퇴원 예정인 환자는 없습니다. 입원·병실 화면에서 고른 환자를 오른쪽에서 처리합니다.</p>
      ) : (
        <table className="w-full text-left text-body">
          <thead className="border-b border-sky text-caption text-ink-sub">
            <tr>
              <th className="px-2 py-2.5 font-semibold">환자</th>
              <th className="px-2 py-2.5 font-semibold">병실</th>
              <th className="px-2 py-2.5 font-semibold">퇴원 예정</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr
                key={a.admissionId}
                {...selectableRow(a.admissionId === selectedId, () => onSelect(a.admissionId))}
              >
                <td className="px-2 py-2.5 font-bold text-ink">{a.patient.name}</td>
                <td className="px-2 py-2.5">{a.roomNo}호</td>
                <td className="px-2 py-2.5">{shortDate(a.expectedDischargeDate!)} (오늘)</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function DischargePanel({ admissionId, onDone }: { admissionId: number; onDone: (r: DischargeResponse) => void }) {
  const detail = useQuery({ queryKey: admissionKeys.detail(admissionId), queryFn: () => admissionApi.detail(admissionId) });
  if (detail.isPending) return <Skeleton rows={5} />;
  if (detail.isError) return <ErrorState title="입원 정보를 불러오지 못했습니다" cause="잠시 뒤 다시 시도하세요." />;
  if (detail.data.dischargedAt) {
    return <EmptyState title="이미 퇴원한 입원입니다" description={`${shortDateTime(detail.data.dischargedAt)}에 퇴원 처리했습니다. 진료비는 원무 창구에서 수납합니다.`} />;
  }
  return <DischargeForm admission={detail.data} onDone={onDone} />;
}

function DischargeForm({ admission: a, onDone }: { admission: AdmissionDetail; onDone: (r: DischargeResponse) => void }) {
  const queryClient = useQueryClient();
  const [at, setAt] = useState(toInputDateTime(now()));
  const days = Math.max(1, daysBetween(a.admittedAt, at));

  const discharge = useMutation({
    mutationFn: () => admissionApi.discharge(a.admissionId, fromInputDateTime(at)),
    onSuccess: (result) => {
      // 병상이 비고, 입원 청구 '미결제'가 생김
      for (const key of [admissionKeys.all, paymentKeys.all, memberKeys.all]) queryClient.invalidateQueries({ queryKey: key });
      onDone(result);
    },
  });
  const err = discharge.error instanceof ApiError ? discharge.error : null;
  const times = err?.code === "VALIDATION_FAILED" ? (err.details as { admittedAt: string; lastRoundAt: string | null } | null) : null;

  return (
    <div className="flex flex-col gap-3 self-start">
      <Card className="flex flex-col gap-1.5">
        <p className="mb-1 text-title font-bold text-ink">
          {a.patient.name} · {a.roomNo}호
        </p>
        <SummaryRow label="입원" value={shortDateTime(a.admittedAt)} />
        <SummaryRow label="재원" value={`${days}일`} />
        <SummaryRow label="회진 기록" value={`${a.summary.roundCount}건`} />
        <SummaryRow label="입원 중 검사 · 원내 처방" value={`${a.summary.examCount}건 · ${a.summary.inHousePrescriptionCount}건`} />
      </Card>
      <p className="text-caption text-ink-sub">퇴원 뒤에는 회진을 추가할 수 없습니다. 빠진 회진·검사가 없는지 지금 확인하세요.</p>

      {err && (
        <ErrorState
          title="퇴원 처리하지 못했습니다"
          cause={
            times
              ? times.lastRoundAt && fromInputDateTime(at) < times.lastRoundAt
                ? `퇴원 일시(${shortDateTime(fromInputDateTime(at))})가 마지막 회진(${shortDateTime(times.lastRoundAt)})보다 빠릅니다. 퇴원 일시를 고치세요.`
                : fromInputDateTime(at) < times.admittedAt
                  ? `퇴원 일시(${shortDateTime(fromInputDateTime(at))})가 입원 일시(${shortDateTime(times.admittedAt)})보다 빠릅니다. 퇴원 일시를 입원 이후로 고치세요.`
                  : "퇴원 일시는 지금보다 늦을 수 없습니다."
              : err.code === "ALREADY_DISCHARGED"
                ? "이미 퇴원 처리된 입원입니다. 진료비는 다시 만들지 않습니다."
                : "잠시 뒤 다시 시도하세요."
          }
        />
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-ink-sub">퇴원 일시</span>
        <input
          type="datetime-local"
          value={at}
          min={toInputDateTime(a.admittedAt)}
          max={toInputDateTime(now())}
          onChange={(e) => {
            setAt(e.target.value);
            discharge.reset(); // 시각을 고치면 이전 오류 문구를 지움
          }}
          className={cx("h-11 rounded-lg border bg-white px-3 text-item text-ink outline-none focus:border-navy", times ? "border-warn" : "border-line/60")}
        />
      </label>

      <div className="rounded-xl border border-sky bg-select-bg px-4 py-3">
        <p className="text-item font-bold text-navy">퇴원하면 진료비가 자동으로 만들어집니다</p>
        <p className="mt-1 text-body text-ink">
          입원료 {days}일과 입원 중 검사·원내 처방을 합친 &lsquo;미결제&rsquo; 결제가 생기고, 원무 창구에서 수납합니다.
        </p>
      </div>

      <Button className="h-11 text-item" disabled={!at || discharge.isPending} onClick={() => discharge.mutate()}>
        {discharge.isPending ? "퇴원 처리하는 중…" : "퇴원 처리"}
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between text-item">
      <span className="text-ink-sub">{label}</span>
      <span className="text-ink">{value}</span>
    </p>
  );
}

function DoneBanner({ result }: { result: DischargeResponse }) {
  return (
    <div role="status" className="mb-5 rounded-xl border border-positive/30 bg-positive-bg px-5 py-4">
      <p className="text-item font-bold text-positive">
        {result.admission.patient.name} 님을 퇴원 처리했습니다
      </p>
      <p className="mt-1 text-body text-ink">
        {result.admission.roomNo}호 병상이 비었고, 입원 진료비 {won(result.payment.amount)}을 &lsquo;미결제&rsquo;로 청구했습니다. 원무 창구에서 수납합니다.
      </p>
    </div>
  );
}
