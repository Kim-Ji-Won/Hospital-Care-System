"use client";

/**
 * S5 입원·병실 — API 5-1, 5-2, 5-4
 * 병실별 사용/전체 병상, 배정 대기(입원 결정 후 병실 미정), 입원 중 환자를 한 화면에서 봅니다.
 * 회진 기록(3-1)은 의사만 하므로 간호사에게는 그 버튼이 없습니다. 퇴원 처리는 의사·간호사 모두 합니다.
 */
import Link from "next/link";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { admissionApi, admissionKeys } from "@/lib/api/admission";
import type { Admission, PendingAdmission, Room } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { daysBetween, shortDate, shortDateTime, today } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { PatientName } from "@/components/patient-label";
import { Chip, ErrorState, PageHeader, Skeleton } from "@/components/ui";

const actionPrimary = "inline-flex h-8 items-center rounded-lg bg-navy px-3 text-body font-semibold text-white hover:bg-navy/90";
const actionSecondary = "inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 text-body font-semibold text-navy hover:bg-select-bg";

export default function AdmissionsPage() {
  const { user } = useAuth();
  const isDoctor = user?.role === "의사";
  const rooms = useQuery({ queryKey: admissionKeys.rooms(), queryFn: () => admissionApi.rooms() });
  const pending = useQuery({ queryKey: admissionKeys.pending(), queryFn: admissionApi.pending });
  const admissions = useQuery({ queryKey: admissionKeys.list(), queryFn: () => admissionApi.list() });
  const dischargeToday = admissions.data?.filter((a) => a.expectedDischargeDate === today()).length ?? 0;

  return (
    <>
      <PageHeader
        title="입원·병실"
        actions={
          dischargeToday > 0 && (
            <Link href="/staff/admissions/discharge" className={actionSecondary}>
              {`오늘 퇴원 예정 ${dischargeToday}명`}
            </Link>
          )
        }
      />

      <RoomBoard query={rooms} />

      {pending.isError ? (
        <div className="mb-6">
          <ErrorState title="배정 대기 환자를 불러오지 못했습니다" cause="잠시 뒤 다시 시도하세요." />
        </div>
      ) : (
        pending.data?.map((p) => <PendingCard key={p.decisionEncounterId} pending={p} />)
      )}

      <QueryView
        query={admissions}
        skeletonRows={4}
        errorTitle="입원 중인 환자를 불러오지 못했습니다"
        empty={{
          title: "입원 중인 환자가 없습니다",
          description: "입원은 외래 진료 기록에서 '입원 결정'을 누르면 시작됩니다. 결정된 환자가 여기 배정 대기로 들어옵니다.",
        }}
      >
        {(list) => <AdmissionTable list={list} isDoctor={isDoctor} />}
      </QueryView>
    </>
  );
}

/** 병동별 병상 (사용/전체). 퇴원일시가 NULL인 입원 수를 병상수와 나란히 */
function RoomBoard({ query }: { query: UseQueryResult<Room[]> }) {
  if (query.isPending) return <Skeleton rows={2} className="mb-6" />;
  if (query.isError) {
    return (
      <div className="mb-6">
        <ErrorState title="병실 현황을 불러오지 못했습니다" cause="잠시 뒤 다시 시도하세요." />
      </div>
    );
  }
  const wards = [...new Set(query.data.map((r) => r.ward))];
  return (
    <>
      {wards.map((ward) => (
        <section key={ward} className="mb-4">
          <h2 className="mb-2 text-body font-bold text-ink-sub">{ward} 병상 (사용/전체)</h2>
          <ul className="grid grid-cols-4 gap-3">
            {query.data
              .filter((r) => r.ward === ward)
              .map((r) => {
                const full = r.occupiedBeds >= r.bedCount;
                return (
                  <li key={r.roomNo} className="flex flex-col items-center rounded-2xl border border-skeleton bg-white py-2.5">
                    <span className="text-title font-bold text-ink">{r.roomNo}호</span>
                    <span className="text-body text-ink-sub">
                      {r.occupiedBeds}/{r.bedCount}
                      {full && " · 만실"}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </>
  );
}

function PendingCard({ pending: p }: { pending: PendingAdmission }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-sky bg-select-bg px-5 py-5">
      <div>
        <p className="text-title font-bold text-ink">배정 대기 · {p.patient.name}</p>
        <p className="text-body text-ink-sub">
          입원 결정 {shortDateTime(p.decidedAt)} · {p.doctorName}
        </p>
      </div>
      <Link href={`/staff/admissions/assign?encounterId=${p.decisionEncounterId}`} className={actionPrimary}>
        병실 배정
      </Link>
    </div>
  );
}

function AdmissionTable({ list, isDoctor }: { list: Admission[]; isDoctor: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed text-left text-body break-keep">
        <colgroup>
          <col className="w-36" />
          <col className="w-24" />
          <col className="w-28" />
          <col className="w-28" />
          <col className="w-32" />
          <col className="w-24" />
          <col />
        </colgroup>
        <thead className="border-b border-sky text-caption text-ink-sub">
          <tr>
            <th className="px-2 py-3 font-semibold">환자</th>
            <th className="px-2 py-3 font-semibold">병실</th>
            <th className="px-2 py-3 font-semibold">주치의</th>
            <th className="px-2 py-3 font-semibold">입원</th>
            <th className="px-2 py-3 font-semibold">퇴원 예정</th>
            <th className="px-2 py-3 font-semibold">일수</th>
            <th className="px-2 py-3"><span className="sr-only">작업</span></th>
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.admissionId} className="border-b border-skeleton">
              <td className="px-2 py-2.5">
                <PatientName patient={a.patient} compact />
              </td>
              <td className="px-2 py-2.5">{a.roomNo}호</td>
              <td className="px-2 py-2.5">{a.attendingName}</td>
              <td className="px-2 py-2.5 whitespace-nowrap">{shortDate(a.admittedAt)}</td>
              <td className="px-2 py-2.5 whitespace-nowrap">
                {a.expectedDischargeDate ? (a.expectedDischargeDate === today() ? `${shortDate(a.expectedDischargeDate)} 오늘` : shortDate(a.expectedDischargeDate)) : "미정"}
              </td>
              <td className="px-2 py-2.5">
                <Chip tone="progress">{`D+${daysBetween(a.admittedAt)}`}</Chip>
              </td>
              <td className="px-2 py-2.5">
                <div className="flex justify-end gap-1.5">
                  {isDoctor && (
                    <Link href={`/staff/admissions/${a.admissionId}/rounds/new`} className={actionPrimary}>
                      회진 기록
                    </Link>
                  )}
                  <Link href={`/staff/admissions/discharge?admissionId=${a.admissionId}`} className={actionSecondary}>
                    퇴원 처리
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
