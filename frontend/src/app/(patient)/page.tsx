"use client";

/**
 * P1 홈 — API 1-5 (예정: 2-4, 6-3, 4-4)
 * 지금은 "내 정보" 카드만 실제 데이터(1-5)로 그립니다.
 * 다음 예약(2-4), 미결제(6-3), 새 검사 결과(4-4)는 해당 API를 붙일 때 채웁니다.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { memberApi, memberKeys } from "@/lib/api/member";
import { useAuth } from "@/lib/auth";
import { QueryView } from "@/components/query-view";
import { Card } from "@/components/ui";

function maskPhone(phone: string) {
  const parts = phone.split("-");
  return parts.length === 3 ? `${parts[0]}-•••-${parts[2]}` : phone;
}

export default function HomePage() {
  const { user } = useAuth();
  const profile = useQuery({ queryKey: memberKeys.profile(), queryFn: memberApi.myProfile });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-step font-bold text-navy">{user?.name} 님, 안녕하세요</h1>
        <Link href="/book" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 font-semibold text-white hover:bg-navy/90">
          진료 예약하기
        </Link>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <Card>
          <p className="text-caption font-semibold text-ink-sub">다음 예약 · 미결제 진료비 · 새 검사 결과</p>
          <p className="mt-2 text-body text-ink-sub">예약·결제·검사 API를 붙이는 단계에서 채웁니다.</p>
        </Card>

        <Card>
          <p className="mb-3 text-item font-semibold text-ink">내 정보</p>
          <QueryView query={profile} skeletonRows={3} errorTitle="내 정보를 불러오지 못했습니다">
            {(p) => (
              <dl className="grid grid-cols-[72px_1fr] gap-y-2 text-body">
                <dt className="text-ink-sub">환자번호</dt>
                <dd className="font-semibold">#{String(p.patientId).padStart(5, "0")}</dd>
                <dt className="text-ink-sub">연락처</dt>
                <dd>{maskPhone(p.phone)}</dd>
                <dt className="text-ink-sub">주소</dt>
                <dd>{p.address ?? "없음"}</dd>
                <dt className="text-ink-sub">혈액형</dt>
                <dd>{p.bloodType ?? "없음"}</dd>
              </dl>
            )}
          </QueryView>
        </Card>
      </div>
    </div>
  );
}
