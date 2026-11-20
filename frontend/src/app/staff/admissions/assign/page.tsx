"use client";

/**
 * S5a 병실 배정 — API 5-2, 1-8, 5-1, 5-3, 5-4
 * 배정 대기 환자에게 병실·주치의·입원 사유를 정해 입원 행을 만듭니다(셋 다 NOT NULL). 버튼을 누른 시각이 입원일시입니다.
 * 빈 병상이 있는 병실만 고를 수 있고, 주치의는 의사만 나오며 기본값은 입원을 결정한 의사입니다.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admissionApi, admissionKeys } from "@/lib/api/admission";
import { ApiError } from "@/lib/api/client";
import { memberApi, memberKeys } from "@/lib/api/member";
import type { PendingAdmission } from "@/lib/api/types";
import { age, patientNo, shortDate, shortDateTime, today, won } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, TextField, cx, selectableRow } from "@/components/ui";

export default function AssignPage() {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <Assign />
    </Suspense>
  );
}

function Assign() {
  const encounterId = Number(useSearchParams().get("encounterId"));
  const pending = useQuery({ queryKey: admissionKeys.pending(), queryFn: admissionApi.pending });

  return (
    <>
      <PageHeader title="병실 배정" />
      <QueryView query={pending} skeletonRows={5} errorTitle="배정 대기 환자를 불러오지 못했습니다">
        {(list) => {
          const target = list.find((p) => p.decisionEncounterId === encounterId);
          if (!target) {
            return (
              <EmptyState
                title="배정 대기인 진료가 아닙니다"
                description="이미 병실을 배정했거나 입원을 결정하지 않은 진료입니다. 배정 대기는 입원·병실 화면에 있습니다."
                action={<Link href="/staff/admissions" className="font-semibold text-navy underline underline-offset-4">입원·병실로 가기</Link>}
              />
            );
          }
          return <AssignForm key={target.decisionEncounterId} pending={target} />;
        }}
      </QueryView>
    </>
  );
}

function AssignForm({ pending: p }: { pending: PendingAdmission }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const doctors = useQuery({ queryKey: memberKeys.staff("의사"), queryFn: () => memberApi.staff("의사") });
  const rooms = useQuery({ queryKey: admissionKeys.rooms(true), queryFn: () => admissionApi.rooms(true) });
  const admissions = useQuery({ queryKey: admissionKeys.list(), queryFn: () => admissionApi.list() });

  const [attendingId, setAttendingId] = useState(p.doctorId);
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState("");
  const [roomNo, setRoomNo] = useState<number | null>(null);
  const [failedRoom, setFailedRoom] = useState<number | null>(null);

  const assign = useMutation({
    mutationFn: () => admissionApi.create({ decisionEncounterId: p.decisionEncounterId, roomNo: roomNo!, attendingId, reason: reason.trim(), expectedDischargeDate: expected || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: admissionKeys.all });
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
      router.push("/staff/admissions");
    },
    onError: (e) => {
      // 그 사이에 병상이 다 찼으면 병실 목록을 새로 받아 그 병실을 목록에서 뺌
      if (e instanceof ApiError && e.code === "ROOM_FULL") {
        setFailedRoom(roomNo);
        setRoomNo(null);
        queryClient.invalidateQueries({ queryKey: admissionKeys.all });
      }
    },
  });

  const errors = assign.error instanceof ApiError && assign.error.code === "VALIDATION_FAILED" ? assign.error.fieldMap() : {};
  const admitted = assign.error instanceof ApiError && assign.error.code === "ALREADY_ADMITTED" ? (assign.error.details as { roomNo: number; admittedAt: string }) : null;
  const canAssign = roomNo != null && reason.trim().length > 0 && !assign.isPending;
  const dischargeToday = admissions.data?.filter((a) => a.expectedDischargeDate === today()).length ?? 0;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 왼쪽: 환자와 입원 정보 */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-sky bg-select-bg px-5 py-4">
          <p className="text-title font-bold text-ink">
            {p.patient.name}{" "}
            <span className="text-body font-bold text-ink-sub">
              {p.patient.gender} · {age(p.patient.birthDate)}세 · {patientNo(p.patient.patientId)}
            </span>
          </p>
          <p className="text-body text-ink-sub">
            입원 결정 {shortDateTime(p.decidedAt)} · {p.doctorName}
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-ink-sub">주치의</span>
          <select
            value={attendingId}
            onChange={(e) => setAttendingId(Number(e.target.value))}
            disabled={doctors.isPending}
            className={cx("h-11 rounded-lg border bg-white px-3 text-item text-ink outline-none focus:border-navy", errors.attendingId ? "border-warn" : "border-line/60")}
          >
            {(doctors.data ?? [{ staffId: p.doctorId, name: p.doctorName, departmentName: p.departmentName }]).map((d) => (
              <option key={d.staffId} value={d.staffId}>
                {d.name} · {d.departmentName}
              </option>
            ))}
          </select>
          {errors.attendingId && <span className="text-caption text-error-ink">{errors.attendingId}</span>}
        </label>
        <TextField label="입원 사유 (필수)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="예: 폐렴 의심, 정맥 항생제 치료" error={errors.reason} />
        <TextField
          label="퇴원 예정일 (선택)"
          type="date"
          min={today()}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          hint="정할 수 없는 장기 입원은 비워 두면 '미정'으로 표시됩니다."
          error={errors.expectedDischargeDate}
        />
      </div>

      {/* 오른쪽: 빈 병상이 있는 병실 */}
      <div className="flex flex-col gap-3">
        <p className="text-body font-bold text-ink-sub">병실 선택</p>

        {failedRoom && (
          <ErrorState title={`${failedRoom}호에 배정하지 못했습니다`} cause="방금 다른 환자가 배정되어 빈 병상이 없습니다. 빈 병상이 있는 병실에서 다시 고르세요." />
        )}
        {admitted && (
          <ErrorState
            title="입원시킬 수 없습니다"
            cause={`${p.patient.name} 님은 이미 ${admitted.roomNo}호에 입원 중입니다 (${shortDate(admitted.admittedAt)} 입원). 지금 입원을 퇴원 처리한 뒤에 다시 입원을 결정할 수 있습니다.`}
            action={<Link href="/staff/admissions" className="font-semibold text-error-ink underline">입원 중 기록 보기</Link>}
          />
        )}
        {assign.isError && !failedRoom && !admitted && !Object.keys(errors).length && (
          <ErrorState
            title="병실을 배정하지 못했습니다"
            cause={assign.error instanceof ApiError && assign.error.code === "INVALID_STATUS" ? "이미 배정한 진료입니다. 입원·병실 화면을 확인하세요." : "입력한 내용은 그대로 있으니 잠시 뒤 다시 시도하세요."}
          />
        )}

        <QueryView
          query={rooms}
          skeletonRows={3}
          errorTitle="병실 목록을 불러오지 못했습니다"
          empty={{
            title: "빈 병상이 없습니다",
            description: `병실이 모두 찼습니다.${dischargeToday ? ` 오늘 퇴원 예정인 ${dischargeToday}명이 퇴원하면 배정할 수 있습니다.` : ""}`,
            action: <Link href="/staff/admissions/discharge" className="font-semibold text-navy underline underline-offset-4">퇴원 처리 보기</Link>,
          }}
        >
          {(list) => (
            <>
              <table className="w-full text-left text-body">
                <thead className="border-b border-sky text-caption text-ink-sub">
                  <tr>
                    <th className="px-2 py-2.5 font-semibold">병실</th>
                    <th className="px-2 py-2.5 font-semibold">남은 병상</th>
                    <th className="px-2 py-2.5 font-semibold">1일 입원료</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr
                      key={r.roomNo}
                      {...selectableRow(r.roomNo === roomNo, () => setRoomNo(r.roomNo))}
                    >
                      <td className="px-2 py-2.5 font-bold text-ink">
                        {r.roomNo}호 · {r.ward}
                      </td>
                      <td className="px-2 py-2.5">{r.bedCount - r.occupiedBeds}자리</td>
                      <td className="px-2 py-2.5">{won(r.dailyFee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button className="h-11 text-item" disabled={!canAssign} onClick={() => assign.mutate()}>
                {assign.isPending ? "배정하는 중…" : roomNo ? `${roomNo}호로 배정하고 입원 시작` : "병실을 고르세요"}
              </Button>
              {roomNo && !reason.trim() && <p className="text-caption text-ink-sub">입원 사유를 입력해야 배정할 수 있습니다.</p>}
            </>
          )}
        </QueryView>
      </div>
    </div>
  );
}
