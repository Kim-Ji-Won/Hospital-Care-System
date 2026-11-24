"use client";

/**
 * P3 내 예약 + P3a 예약 변경·취소 — API 2-4, 2-9 (시간 변경 2-8은 /reservations/change)
 * 다가오는 예약과 지난 예약을 표 두 개로 나눠 보여 줍니다. 취소해도 행은 남고 상태 칩만 바뀝니다.
 * 시간 변경·취소 버튼은 '예약' 상태에만 있고, 완료·취소·노쇼 행은 읽기 전용입니다.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { reservationApi, reservationKeys } from "@/lib/api/reservation";
import type { MyReservation } from "@/lib/api/types";
import { longDate, shortDateTime, timeOf, today } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Chip, ConfirmDialog, PageHeader } from "@/components/ui";

export default function ReservationsPage() {
  const reservations = useQuery({ queryKey: reservationKeys.mine(), queryFn: reservationApi.mine });

  return (
    <>
      <PageHeader
        title="내 예약"
        actions={
          <Link href="/book" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 font-semibold text-white hover:bg-navy/90">
            + 새 예약
          </Link>
        }
      />
      <QueryView
        query={reservations}
        skeletonRows={5}
        errorTitle="예약을 불러오지 못했습니다"
        empty={{
          title: "아직 예약이 없습니다",
          description: "진료과와 시간만 고르면 담당 의사는 자동으로 배정됩니다.",
          action: (
            <Link href="/book" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 font-semibold text-white">
              진료 예약하기
            </Link>
          ),
        }}
      >
        {(list) => (
          <div className="flex flex-col gap-4">
            <Suspense>
              <CreatedBanner list={list} />
            </Suspense>
            <ReservationTable list={list} />
          </div>
        )}
      </QueryView>
    </>
  );
}

/** 예약·시간 변경 직후(?created=, ?changed=) 배정된 담당 의사를 알려 줌 */
function CreatedBanner({ list }: { list: MyReservation[] }) {
  const params = useSearchParams();
  const changed = Number(params.get("changed"));
  const id = changed || Number(params.get("created"));
  const r = list.find((x) => x.reservationId === id);
  if (!r) return null;
  return (
    <div role="status" className="rounded-xl border border-positive/30 bg-positive-bg px-5 py-4">
      <p className="text-item font-bold text-positive">{changed ? "예약 시간을 바꿨습니다" : "예약됐습니다"}</p>
      <p className="mt-1 text-body text-ink">
        {longDate(r.appointmentAt)} {timeOf(r.appointmentAt)} {r.departmentName}. 담당 의사는 {r.doctorName}입니다.
        {r.departmentLocation && ` 진료실은 ${r.departmentLocation}입니다.`}
      </p>
    </div>
  );
}

function ReservationTable({ list }: { list: MyReservation[] }) {
  const todayDate = today();
  // 한 표에 섞으면 날짜가 올라가다 내려가므로 둘로 나눔: 다가오는 예약은 가까운 순, 지난 예약은 최근 순
  // 오늘의 '예약'은 시간이 지나도 아직 진료·노쇼 처리 전이므로 다가오는 예약에 둠
  const isUpcoming = (r: MyReservation) => r.status === "예약" && r.appointmentAt.slice(0, 10) >= todayDate;
  const upcoming = list.filter(isUpcoming).sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt));
  const past = list.filter((r) => !isUpcoming(r)).sort((a, b) => b.appointmentAt.localeCompare(a.appointmentAt));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-item font-bold text-ink">다가오는 예약</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-sky bg-white px-5 py-4 text-body text-ink-sub">예정된 예약이 없습니다.</p>
        ) : (
          <Rows list={upcoming} withActions />
        )}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-item font-bold text-ink">지난 예약</h2>
          <Rows list={past} />
        </section>
      )}
    </div>
  );
}

function Rows({ list, withActions }: { list: MyReservation[]; withActions?: boolean }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<MyReservation | null>(null);
  const cancel = useMutation({
    mutationFn: (r: MyReservation) => reservationApi.cancel(r.reservationId),
    onSuccess: () => {
      setCancelling(null);
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });

  return (
    <>
    <div className="overflow-x-auto rounded-xl border border-sky bg-white">
      {/* 열 너비를 고정해 두 표의 칸이 같은 자리에 오게 하고, 남는 폭은 증상 메모가 가져감 */}
      <table className="w-full min-w-[760px] table-fixed text-left text-body break-keep">
        <colgroup>
          <col className="w-56" />
          <col className="w-32" />
          <col className="w-28" />
          <col />
          <col className="w-24" />
          {withActions && <col className="w-44" />}
        </colgroup>
        <thead className="border-b border-sky bg-page text-caption text-ink-sub">
          <tr>
            <th className="px-5 py-3 font-semibold">진료 일시</th>
            <th className="px-5 py-3 font-semibold">진료과</th>
            <th className="px-5 py-3 font-semibold">담당의</th>
            <th className="px-5 py-3 font-semibold">증상 메모</th>
            <th className="px-5 py-3 font-semibold">상태</th>
            {withActions && <th className="px-5 py-3" />}
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.reservationId} className="border-b border-skeleton last:border-0">
              <td className="px-5 py-3.5 text-item font-semibold whitespace-nowrap">{shortDateTime(r.appointmentAt)}</td>
              <td className="px-5 py-3.5">{r.departmentName}</td>
              <td className="px-5 py-3.5">{r.doctorName}</td>
              <td className="px-5 py-3.5 text-ink-sub">{r.symptomNote ?? "메모 없음"}</td>
              <td className="px-5 py-3.5">
                <Chip>{r.status}</Chip>
              </td>
              {withActions && (
                <td className="px-5 py-3.5">
                  {r.status === "예약" && (
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/reservations/change?reservationId=${r.reservationId}`}
                        className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 font-semibold text-navy hover:bg-select-bg"
                      >
                        시간 변경
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          cancel.reset();
                          setCancelling(r);
                        }}
                        className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 font-semibold text-navy hover:bg-select-bg"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ConfirmDialog
      open={!!cancelling}
      title="예약을 취소할까요?"
      cancelLabel="예약 유지"
      confirmLabel="예약 취소"
      pending={cancel.isPending}
      onConfirm={() => cancelling && cancel.mutate(cancelling)}
      onCancel={() => setCancelling(null)}
    >
      {cancelling && (
        <>
          <p>
            {longDate(cancelling.appointmentAt)} {timeOf(cancelling.appointmentAt)} {cancelling.departmentName} · {cancelling.doctorName}
          </p>
          <p>취소하면 되돌릴 수 없고, 이 시간은 다른 분이 예약할 수 있습니다.</p>
          {cancel.isError && (
            <p className="mt-2 text-error-ink">
              {cancel.error instanceof ApiError && cancel.error.code === "INVALID_STATUS" ? "이미 진료를 마쳤거나 취소된 예약입니다." : "취소하지 못했습니다. 예약은 그대로 있으니 잠시 뒤 다시 시도하세요."}
            </p>
          )}
        </>
      )}
    </ConfirmDialog>
    </>
  );
}
