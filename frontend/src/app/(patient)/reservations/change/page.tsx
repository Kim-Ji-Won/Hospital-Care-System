"use client";

/**
 * P3a 예약 시간 변경 — API 2-4, 2-8 (+ 1-7, 2-1, 2-2)
 * P2 예약 선택 화면을 다시 씁니다. 변경할 때도 요일·시간 범위·중복 검사를 똑같이 거치기 때문입니다.
 * 진료과는 지금 예약 것으로 고정하고, 새 시각의 빈 일정으로 다시 배정하므로 담당 의사가 바뀔 수 있습니다.
 */
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { reservationApi, reservationKeys } from "@/lib/api/reservation";
import { BookingForm } from "@/components/booking-form";
import { QueryView } from "@/components/query-view";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui";

export default function ChangeReservationPage() {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <Change />
    </Suspense>
  );
}

function Change() {
  const reservationId = Number(useSearchParams().get("reservationId"));
  const reservations = useQuery({ queryKey: reservationKeys.mine(), queryFn: reservationApi.mine });
  const back = <Link href="/reservations" className="font-semibold text-navy underline underline-offset-4">내 예약으로 돌아가기</Link>;

  return (
    <QueryView query={reservations} skeletonRows={6} errorTitle="예약을 불러오지 못했습니다">
      {(list) => {
        const r = list.find((x) => x.reservationId === reservationId);
        if (!r || r.status !== "예약") {
          return (
            <>
              <PageHeader title="예약 시간 변경" />
              <EmptyState
                title={r ? `이 예약은 '${r.status}' 상태입니다` : "바꿀 예약을 찾지 못했습니다"}
                description="시간 변경은 '예약' 상태인 예약만 할 수 있습니다."
                action={back}
              />
            </>
          );
        }
        return <BookingForm key={r.reservationId} change={r} />;
      }}
    </QueryView>
  );
}
