"use client";

/**
 * S3 환자 — API 1-9, 1-6
 * 이름, 환자번호, 연락처 뒷자리로 찾고, 고른 환자의 요약을 오른쪽에 보여 줍니다.
 * 등록 버튼은 없습니다. 환자 행은 웹 회원가입(P0a)에서만 생기고, 의료진은 찾고·보고·고치기만 합니다.
 * 서버 오류를 "찾은 환자가 없음"으로 오해하지 않게 두 문구를 따로 둡니다.
 */
import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { memberApi, memberKeys } from "@/lib/api/member";
import type { PatientSearchItem } from "@/lib/api/types";
import { patientNo, shortDate, shortDateTime } from "@/lib/date";
import { josa } from "@/lib/josa";
import { Button, Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton, selectableRow } from "@/components/ui";

const maskPhone = (phone: string) => phone.replace(/^(\d+)-(\d+)-(\d+)$/, (_, a, _b, c) => `${a}-••••-${c}`);
const birthLabel = (p: PatientSearchItem) => `${p.birthDate.replaceAll("-", ". ")} · ${p.gender}`;

export default function PatientsPage() {
  const [input, setInput] = useState("");
  const q = input.trim();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const search = useQuery({
    queryKey: memberKeys.search(q),
    queryFn: () => memberApi.search(q),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });
  const list = q ? search.data : undefined;
  const selected = list?.find((p) => p.patientId === selectedId) ?? null;

  return (
    <>
      <PageHeader title="환자" />
      <label className="mb-5 flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-ink-sub">이름, 환자번호, 연락처 뒷자리로 검색</span>
        <input
          value={input}
          maxLength={50}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 김서, 10234, 4821"
          className="h-11 rounded-lg border border-line/60 bg-white px-3 text-item text-ink outline-none focus:border-navy"
        />
      </label>

      {!q ? (
        <EmptyState title="찾을 환자를 입력하세요" description="이름 일부, 환자번호, 연락처 뒷자리 중 아무거나로 찾을 수 있습니다." />
      ) : search.isError ? (
        <ErrorState
          title="환자를 검색하지 못했습니다"
          cause="서버가 응답하지 않습니다. 다시 시도하세요. 결과가 없다는 뜻이 아닙니다."
          action={
            <Button variant="secondary" onClick={() => search.refetch()}>
              다시 검색
            </Button>
          }
        />
      ) : !list ? (
        <Skeleton rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          title={`${josa(`'${q}'`, "으로/로")} 찾은 환자가 없습니다`}
          description="철자를 확인하거나 연락처 뒷자리로 다시 찾아보세요. 아직 가입하지 않은 분이면 웹 회원가입을 안내하세요."
          action={
            <Button variant="secondary" onClick={() => setInput("")}>
              검색어 지우기
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[1fr_300px] gap-6">
          <table className="w-full table-fixed self-start text-left text-body">
            <colgroup>
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-44" />
              <col />
              <col className="w-24" />
            </colgroup>
            <thead className="border-b border-sky text-caption text-ink-sub">
              <tr>
                <th className="px-2 py-2.5 font-semibold">환자번호</th>
                <th className="px-2 py-2.5 font-semibold">이름</th>
                <th className="px-2 py-2.5 font-semibold">생년월일 · 성별</th>
                <th className="px-2 py-2.5 font-semibold">연락처</th>
                <th className="px-2 py-2.5"><span className="sr-only">입원 여부</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr
                  key={p.patientId}
                  {...selectableRow(p.patientId === selectedId, () => setSelectedId(p.patientId))}
                >
                  <td className="px-2 py-2.5 font-bold text-ink">{patientNo(p.patientId)}</td>
                  <td className="px-2 py-2.5">{p.name}</td>
                  <td className="px-2 py-2.5">{birthLabel(p)}</td>
                  <td className="px-2 py-2.5">{maskPhone(p.phone)}</td>
                  <td className="px-2 py-2.5">{p.admitted && <Chip>입원 중</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selected ? (
            <PatientSummaryCard key={selected.patientId} patientId={selected.patientId} />
          ) : (
            <div className="self-start rounded-xl border border-dashed border-sky bg-white p-6 text-center text-body text-ink-sub">환자를 고르면 요약이 여기에 보입니다.</div>
          )}
        </div>
      )}
    </>
  );
}

function PatientSummaryCard({ patientId }: { patientId: number }) {
  const detail = useQuery({ queryKey: memberKeys.patient(patientId), queryFn: () => memberApi.patient(patientId) });
  if (detail.isPending) return <Skeleton rows={4} />;
  if (detail.isError) return <ErrorState title="환자 정보를 불러오지 못했습니다" cause="잠시 뒤 다시 시도하세요." />;
  const p = detail.data;
  return (
    <Card className="flex flex-col gap-3 self-start bg-select-bg">
      <p className="text-title font-bold text-ink">
        {p.name} {patientNo(p.patientId)}
      </p>
      <dl className="grid grid-cols-[72px_1fr] gap-y-1.5 text-body">
        <dt className="text-ink-sub">주소</dt>
        <dd className="text-right">{p.address ?? "없음"}</dd>
        <dt className="text-ink-sub">혈액형</dt>
        <dd className="text-right">{p.bloodType ?? "없음"}</dd>
        <dt className="text-ink-sub">최근 진료</dt>
        <dd className="text-right">{p.lastEncounter ? `${shortDate(p.lastEncounter.encounterAt)} ${p.lastEncounter.departmentName}` : "없음"}</dd>
        <dt className="text-ink-sub">다음 예약</dt>
        <dd className="text-right">{p.nextReservation ? shortDateTime(p.nextReservation.appointmentAt) : "없음"}</dd>
        {p.currentAdmission && (
          <>
            <dt className="text-ink-sub">입원</dt>
            <dd className="text-right">
              {p.currentAdmission.roomNo}호 · {shortDate(p.currentAdmission.admittedAt)}부터
            </dd>
          </>
        )}
      </dl>
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/staff/patients/${p.patientId}/edit`} className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white text-body font-semibold text-navy hover:bg-select-bg">
          정보 수정
        </Link>
        <Link href={`/staff/patients/${p.patientId}`} className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-white text-body font-semibold text-navy hover:bg-select-bg">
          이력 보기
        </Link>
      </div>
    </Card>
  );
}
