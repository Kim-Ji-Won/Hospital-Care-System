"use client";

/**
 * P1 홈 — API 1-5, 2-4, 6-3, 4-4
 * 지금 챙겨야 할 것 순서: 다음 예약(가장 크게) → 미결제 진료비 → 새 검사 결과, 그리고 내 정보.
 * 입원 카드(5-7)는 2순위에서 붙입니다.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { memberApi, memberKeys } from "@/lib/api/member";
import { orderApi, orderKeys } from "@/lib/api/order";
import { paymentApi, paymentKeys } from "@/lib/api/payment";
import { reservationApi, reservationKeys } from "@/lib/api/reservation";
import { useAuth } from "@/lib/auth";
import { longDate, now, shortDate, timeOf, won, patientNo } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Card, Chip } from "@/components/ui";

function maskPhone(phone: string) {
  const parts = phone.split("-");
  return parts.length === 3 ? `${parts[0]}-•••-${parts[2]}` : phone;
}

export default function HomePage() {
  const { user } = useAuth();
  const profile = useQuery({ queryKey: memberKeys.profile(), queryFn: memberApi.myProfile });
  const reservations = useQuery({ queryKey: reservationKeys.mine(), queryFn: reservationApi.mine });
  const payments = useQuery({ queryKey: paymentKeys.mine(), queryFn: paymentApi.mine });
  const exams = useQuery({ queryKey: orderKeys.mine(), queryFn: orderApi.mine });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-step font-bold text-navy">{user?.name} 님, 안녕하세요</h1>
        <Link href="/book" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 font-semibold text-white hover:bg-navy/90">
          진료 예약하기
        </Link>
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-6">
        {/* 다음 예약 */}
        <Card>
          <p className="mb-3 text-item font-semibold text-ink">다음 예약</p>
          <QueryView query={reservations} skeletonRows={2} errorTitle="예약을 불러오지 못했습니다">
            {(list) => {
              const next = list
                .filter((r) => r.status === "예약" && r.appointmentAt >= now())
                .sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt))[0];
              if (!next) {
                return (
                  <div className="flex items-center justify-between rounded-lg bg-page px-4 py-5">
                    <p className="text-body text-ink-sub">잡힌 예약이 없습니다.</p>
                    <Link href="/book" className="font-semibold text-navy underline underline-offset-4">
                      예약하러 가기
                    </Link>
                  </div>
                );
              }
              return (
                <div className="flex flex-col gap-3">
                  <p className="text-step font-bold text-navy">
                    {longDate(next.appointmentAt)} {timeOf(next.appointmentAt)}
                  </p>
                  <p className="text-item text-ink">
                    {next.departmentName} · 담당의 {next.doctorName}
                    {next.departmentLocation && <span className="text-ink-sub"> · {next.departmentLocation}</span>}
                  </p>
                  <Link href="/reservations" className="self-start text-body font-semibold text-navy underline underline-offset-4">
                    내 예약 보기
                  </Link>
                </div>
              );
            }}
          </QueryView>
        </Card>

        {/* 미결제 진료비 */}
        <Card>
          <p className="mb-3 text-item font-semibold text-ink">미결제 진료비</p>
          <QueryView query={payments} skeletonRows={2} errorTitle="진료비를 불러오지 못했습니다">
            {(list) => {
              const unpaid = list.filter((p) => p.status === "미결제");
              if (unpaid.length === 0) return <p className="text-body text-ink-sub">낼 진료비가 없습니다.</p>;
              const total = unpaid.reduce((sum, p) => sum + p.amount, 0);
              return (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-step font-bold text-navy">{won(total)}</p>
                    <Chip>미결제</Chip>
                  </div>
                  <ul className="text-body text-ink-sub">
                    {unpaid.map((p) => (
                      <li key={p.paymentId}>
                        {shortDate(p.encounterAt)} {p.departmentName} {p.billingType} · {won(p.amount)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-caption text-ink-sub">1층 원무과 창구에서 수납합니다.</p>
                </div>
              );
            }}
          </QueryView>
        </Card>

        {/* 새 검사 결과 */}
        <Card>
          <p className="mb-3 text-item font-semibold text-ink">새 검사 결과</p>
          <QueryView query={exams} skeletonRows={2} errorTitle="검사 결과를 불러오지 못했습니다">
            {(list) =>
              list.length === 0 ? (
                <p className="text-body text-ink-sub">판독이 끝난 검사가 아직 없습니다.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-skeleton">
                  {list.slice(0, 3).map((x) => (
                    <li key={x.examId} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-item font-semibold">{x.examName}</p>
                        <p className="text-caption text-ink-sub">{shortDate(x.performedAt)} 판독 완료</p>
                      </div>
                      {/* 이상 판정만 주황 칩. 경고색은 화면에 한 군데만 */}
                      {x.resultFlag === "이상" ? <Chip>이상</Chip> : <span className="text-body text-ink-sub">정상</span>}
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryView>
          <Link href="/results" className="mt-2 inline-block text-body font-semibold text-navy underline underline-offset-4">
            검사 결과 전체 보기
          </Link>
        </Card>

        {/* 내 정보 */}
        <Card>
          <p className="mb-3 text-item font-semibold text-ink">내 정보</p>
          <QueryView query={profile} skeletonRows={3} errorTitle="내 정보를 불러오지 못했습니다">
            {(p) => (
              <dl className="grid grid-cols-[72px_1fr] gap-y-2 text-body">
                <dt className="text-ink-sub">환자번호</dt>
                <dd className="font-semibold">{patientNo(p.patientId)}</dd>
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
