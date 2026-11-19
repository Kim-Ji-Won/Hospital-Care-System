"use client";

/**
 * P3 내 예약 — API 2-4
 * 예정 예약과 지난 예약을 한 표에 보여 줍니다. 취소해도 행은 남고 상태 칩만 바뀝니다.
 * 시간 변경·취소(P3a, 2-8·2-9)는 3순위라 아직 버튼이 없습니다.
 */
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { reservationApi, reservationKeys } from "@/lib/api/reservation";
import type { MyReservation } from "@/lib/api/types";
import { longDate, now, shortDateTime, timeOf } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Chip, PageHeader } from "@/components/ui";

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

/** 예약 직후(P2에서 ?created=번호로 넘어옴) 배정된 담당 의사를 알려 줌 */
function CreatedBanner({ list }: { list: MyReservation[] }) {
  const created = Number(useSearchParams().get("created"));
  const r = list.find((x) => x.reservationId === created);
  if (!r) return null;
  return (
    <div role="status" className="rounded-xl border border-positive/30 bg-positive-bg px-5 py-4">
      <p className="text-item font-bold text-positive">예약됐습니다</p>
      <p className="mt-1 text-body text-ink">
        {longDate(r.appointmentAt)} {timeOf(r.appointmentAt)} {r.departmentName}. 담당 의사는 {r.doctorName}입니다.
        {r.departmentLocation && ` 진료실은 ${r.departmentLocation}입니다.`}
      </p>
    </div>
  );
}

function ReservationTable({ list }: { list: MyReservation[] }) {
  const nowAt = now();
  // 예정(지금 이후 '예약')은 가까운 순, 지난 예약은 최근 순
  const upcoming = list.filter((r) => r.status === "예약" && r.appointmentAt >= nowAt).sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt));
  const past = list.filter((r) => !upcoming.includes(r));

  return (
    <div className="overflow-hidden rounded-xl border border-sky bg-white">
      <table className="w-full text-left text-body">
        <thead className="border-b border-sky bg-page text-caption text-ink-sub">
          <tr>
            <th className="px-5 py-3 font-semibold">진료 일시</th>
            <th className="px-5 py-3 font-semibold">진료과</th>
            <th className="px-5 py-3 font-semibold">담당의</th>
            <th className="px-5 py-3 font-semibold">증상 메모</th>
            <th className="px-5 py-3 font-semibold">상태</th>
          </tr>
        </thead>
        <tbody>
          {[...upcoming, ...past].map((r) => (
            <tr key={r.reservationId} className="border-b border-skeleton last:border-0">
              <td className="px-5 py-3.5 text-item font-semibold">{shortDateTime(r.appointmentAt)}</td>
              <td className="px-5 py-3.5">{r.departmentName}</td>
              <td className="px-5 py-3.5">{r.doctorName}</td>
              <td className="px-5 py-3.5 text-ink-sub">{r.symptomNote ?? "메모 없음"}</td>
              <td className="px-5 py-3.5">
                <Chip>{r.status}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
