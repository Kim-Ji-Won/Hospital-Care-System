"use client";

/**
 * P3 내 예약 — API 2-4
 * 다가오는 예약과 지난 예약을 표 두 개로 나눠 보여 줍니다. 취소해도 행은 남고 상태 칩만 바뀝니다.
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
  // 한 표에 섞으면 날짜가 올라가다 내려가므로 둘로 나눔: 다가오는 예약은 가까운 순, 지난 예약은 최근 순
  const isUpcoming = (r: MyReservation) => r.status === "예약" && r.appointmentAt >= nowAt;
  const upcoming = list.filter(isUpcoming).sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt));
  const past = list.filter((r) => !isUpcoming(r)).sort((a, b) => b.appointmentAt.localeCompare(a.appointmentAt));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-item font-bold text-ink">다가오는 예약</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-sky bg-white px-5 py-4 text-body text-ink-sub">예정된 예약이 없습니다.</p>
        ) : (
          <Rows list={upcoming} />
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

function Rows({ list }: { list: MyReservation[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-sky bg-white">
      {/* 열 너비를 고정해 두 표의 칸이 같은 자리에 오게 하고, 남는 폭은 증상 메모가 가져감 */}
      <table className="w-full min-w-[760px] table-fixed text-left text-body break-keep">
        <colgroup>
          <col className="w-56" />
          <col className="w-32" />
          <col className="w-28" />
          <col />
          <col className="w-24" />
        </colgroup>
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
          {list.map((r) => (
            <tr key={r.reservationId} className="border-b border-skeleton last:border-0">
              <td className="px-5 py-3.5 text-item font-semibold whitespace-nowrap">{shortDateTime(r.appointmentAt)}</td>
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
