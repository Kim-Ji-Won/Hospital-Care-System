"use client";

/**
 * S1 오늘 진료 (+ S9 간호사가 보는 오늘 진료, 노쇼 확인 대화상자) — API 2-5, 1-6, 2-7
 * 의사는 본인 일정, 간호사는 진료과 전체를 봅니다. 간호사에게는 진료 시작·노쇼 버튼 대신 담당의 컬럼이 붙습니다.
 * 날짜를 골라 다른 날 예약도 볼 수 있습니다(2-5의 date). 진료 시작·노쇼 처리는 오늘 예약에만 둡니다.
 */
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { memberApi, memberKeys } from "@/lib/api/member";
import { reservationApi, reservationKeys } from "@/lib/api/reservation";
import type { StaffReservation } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { hm, longDate, shortDate, timeOf, today } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { PatientName, patientLine } from "@/components/patient-label";
import { Button, Card, Chip, ConfirmDialog, ErrorState, PageHeader, Skeleton, cx } from "@/components/ui";

export default function TodayPage() {
  const { user } = useAuth();
  const isDoctor = user?.role === "의사";
  const todayDate = today();
  const [date, setDate] = useState(todayDate);
  const isToday = date === todayDate;
  const daily = useQuery({ queryKey: reservationKeys.daily(date), queryFn: () => reservationApi.daily(date) });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const moveTo = (next: string) => {
    setDate(next);
    setSelectedId(null);
  };

  return (
    <>
      <PageHeader
        title={isToday ? `오늘 진료 · ${longDate(date)}` : `${longDate(date)} 진료`}
        sub={isDoctor ? undefined : `${user?.departmentName ?? ""} 전체`}
        actions={
          <div className="flex items-center gap-4">
            {daily.data && <Summary list={daily.data.reservations} />}
            <div className="flex items-center gap-2">
              {/* 날짜를 지우면 빈 값이 오므로 그때는 그대로 둠 */}
              <input
                type="date"
                aria-label="날짜 선택"
                value={date}
                onChange={(e) => e.target.value && moveTo(e.target.value)}
                className="h-10 rounded-lg border border-line/60 bg-white px-3 text-body outline-none focus:border-navy"
              />
              <Button variant="secondary" onClick={() => moveTo(todayDate)} disabled={isToday}>
                오늘
              </Button>
            </div>
          </div>
        }
      />
      <QueryView
        query={daily}
        skeletonRows={5}
        errorTitle="오늘 진료 목록을 불러오지 못했습니다"
        isEmpty={(d) => d.reservations.length === 0}
        empty={
          daily.data?.dayOffs.length
            ? {
                title: "오늘은 휴진입니다",
                description: daily.data.dayOffs
                  .map((o) => `${o.doctorName ?? ""} ${hm(o.startTime)}~${hm(o.endTime)}${o.reason ? ` (${o.reason})` : ""}`)
                  .join(", "),
              }
            : {
                title: isToday ? "오늘 잡힌 예약이 없습니다" : "이날 잡힌 예약이 없습니다",
                description: "예약은 환자가 웹에서만 만듭니다. 새 예약이 생기면 이 목록에 나타납니다.",
              }
        }
      >
        {(d) => {
          const selected = d.reservations.find((r) => r.reservationId === selectedId) ?? null;
          return (
            <div className="grid grid-cols-[1fr_340px] gap-6">
              <ReservationTable list={d.reservations} showDoctor={!isDoctor} selectedId={selectedId} onSelect={setSelectedId} />
              {selected ? (
                <PatientPanel reservation={selected} canAct={isDoctor} isToday={isToday} />
              ) : (
                <div className="rounded-xl border border-dashed border-sky bg-white p-6 text-center text-body text-ink-sub">
                  목록에서 환자를 고르면 요약이 여기에 보입니다.
                </div>
              )}
            </div>
          );
        }}
      </QueryView>
    </>
  );
}

function Summary({ list }: { list: StaffReservation[] }) {
  const count = (s: string) => list.filter((r) => r.status === s).length;
  return (
    <div className="flex gap-2">
      <Chip tone="progress">{`대기 ${count("예약")}`}</Chip>
      <Chip tone="done">{`완료 ${count("완료")}`}</Chip>
      <Chip tone="void">{`노쇼 ${count("노쇼")}`}</Chip>
    </div>
  );
}

function ReservationTable({
  list,
  showDoctor,
  selectedId,
  onSelect,
}: {
  list: StaffReservation[];
  showDoctor: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-sky bg-white">
      <table className="w-full text-left text-body">
        <thead className="border-b border-sky bg-page text-caption text-ink-sub">
          <tr>
            <th className="w-20 px-4 py-3 font-semibold">시간</th>
            <th className="px-4 py-3 font-semibold">환자</th>
            {showDoctor && <th className="px-4 py-3 font-semibold">담당의</th>}
            <th className="px-4 py-3 font-semibold">증상 메모</th>
            <th className="w-20 px-4 py-3 font-semibold">상태</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr
              key={r.reservationId}
              onClick={() => onSelect(r.reservationId)}
              aria-selected={r.reservationId === selectedId}
              className={cx("cursor-pointer border-b border-skeleton last:border-0 hover:bg-page", r.reservationId === selectedId && "bg-select-bg hover:bg-select-bg")}
            >
              <td className="px-4 py-3 text-item font-semibold">{timeOf(r.appointmentAt)}</td>
              <td className="px-4 py-3">
                <PatientName patient={r.patient} compact />
              </td>
              {showDoctor && <td className="px-4 py-3">{r.doctorName}</td>}
              <td className={cx("px-4 py-3", r.symptomNote ? "text-ink" : "text-ink-sub")}>{r.symptomNote ?? "메모 없음"}</td>
              <td className="px-4 py-3">
                <Chip>{r.status}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 오른쪽 환자 요약과 진료 시작·노쇼 처리 */
function PatientPanel({ reservation, canAct, isToday }: { reservation: StaffReservation; canAct: boolean; isToday: boolean }) {
  const queryClient = useQueryClient();
  const patient = useQuery({ queryKey: memberKeys.patient(reservation.patient.patientId), queryFn: () => memberApi.patient(reservation.patient.patientId) });
  const [confirming, setConfirming] = useState(false);
  const noShow = useMutation({
    mutationFn: () => reservationApi.noShow(reservation.reservationId),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
    },
  });

  return (
    <Card className="flex flex-col gap-4 self-start">
      <div>
        <p className="text-title font-bold text-ink">{reservation.patient.name}</p>
        <p className="text-caption text-ink-sub">{patientLine(reservation.patient)}</p>
      </div>
      {patient.isPending ? (
        <Skeleton rows={2} />
      ) : patient.isError ? (
        <ErrorState title="환자 정보를 불러오지 못했습니다" />
      ) : (
        <dl className="grid grid-cols-[72px_1fr] gap-y-2 text-body">
          <dt className="text-ink-sub">예약</dt>
          <dd>{timeOf(reservation.appointmentAt)}</dd>
          <dt className="text-ink-sub">최근 진료</dt>
          <dd>
            {patient.data.lastEncounter
              ? `${shortDate(patient.data.lastEncounter.encounterAt)} ${patient.data.lastEncounter.primaryDiseaseName ?? patient.data.lastEncounter.departmentName}`
              : "첫 진료"}
          </dd>
          <dt className="text-ink-sub">혈액형</dt>
          <dd>{patient.data.bloodType ?? "없음"}</dd>
          {patient.data.currentAdmission && (
            <>
              <dt className="text-ink-sub">입원</dt>
              <dd>
                <Chip>입원 중</Chip> {patient.data.currentAdmission.roomNo}호
              </dd>
            </>
          )}
        </dl>
      )}

      {reservation.status === "완료" && <p className="rounded-lg bg-positive-bg px-3 py-2 text-body text-positive">진료를 마쳤습니다.</p>}
      {reservation.status === "노쇼" && <p className="rounded-lg bg-neutral-bg px-3 py-2 text-body text-ink-sub">노쇼로 처리했습니다.</p>}

      {/* 버튼은 오늘의 '예약' 상태에서만. 진료 시작은 화면 이동만 하고, 진료 행은 S2 저장 때 생김 */}
      {!isToday && reservation.status === "예약" && <p className="text-caption text-ink-sub">진료 시작과 노쇼 처리는 진료 당일에 합니다.</p>}
      {isToday && canAct && reservation.status === "예약" && (
        <div className="flex flex-col gap-2">
          <Link
            href={`/staff/encounters/new?reservationId=${reservation.reservationId}`}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-navy font-semibold text-white hover:bg-navy/90"
          >
            진료 시작
          </Link>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            노쇼 처리
          </Button>
        </div>
      )}
      {isToday && !canAct && reservation.status === "예약" && <p className="text-caption text-ink-sub">진료 시작과 노쇼 처리는 담당 의사가 합니다.</p>}

      <ConfirmDialog
        open={confirming}
        title="노쇼로 처리할까요?"
        confirmLabel="노쇼 처리"
        pending={noShow.isPending}
        onConfirm={() => noShow.mutate()}
        onCancel={() => {
          setConfirming(false);
          noShow.reset();
        }}
      >
        <p>
          {timeOf(reservation.appointmentAt)} {reservation.patient.name} 님의 예약을 노쇼로 바꿉니다. 되돌릴 수 없고 환자 이력에 남습니다.
        </p>
        {noShow.isError && (
          <p className="mt-2 text-error-ink">
            {noShow.error instanceof ApiError && noShow.error.code === "INVALID_STATUS" ? "이미 상태가 바뀐 예약입니다. 목록을 새로 불러오세요." : "처리하지 못했습니다. 다시 시도하세요."}
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}

