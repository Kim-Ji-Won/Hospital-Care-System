"use client";

/**
 * S3b 환자 이력 — API 1-6, 1-11
 * 예약·진료·검사·입원·결제를 한 표로 합쳐 최근 순으로 보여 주고, 종류별 건수로 거를 수 있습니다. 여기서는 아무것도 고치지 않습니다.
 * 의료진에게는 진행 중인 검사(요청·시행)도 보입니다(환자 화면 P5는 '완료'만).
 */
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { memberApi, memberKeys } from "@/lib/api/member";
import type { PatientHistory } from "@/lib/api/types";
import { patientNo, shortDate, shortDateTime, won } from "@/lib/date";
import { Button, Chip, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from "@/components/ui";

type Kind = "예약" | "진료" | "검사" | "입원" | "결제";
interface Row {
  key: string;
  kind: Kind;
  at: string;
  when: string;
  content: string;
  status: string;
  tone?: "progress" | "done" | "void" | "alert";
}

/** 종류별 배열을 한 표의 행으로 */
function toRows(h: PatientHistory): Row[] {
  const rows: Row[] = [
    ...h.reservations.map((r) => ({
      key: `r${r.reservationId}`,
      kind: "예약" as const,
      at: r.appointmentAt,
      when: shortDateTime(r.appointmentAt),
      content: [r.departmentName, r.doctorName, r.symptomNote].filter(Boolean).join(" · "),
      status: r.status,
    })),
    ...h.encounters.map((e) => ({
      key: `e${e.encounterId}`,
      kind: "진료" as const,
      at: e.encounterAt,
      when: shortDateTime(e.encounterAt),
      content: [`${e.departmentName} ${e.encounterType === "외래" ? "외래" : "입원 회진"}`, e.primaryDiseaseName && `${e.primaryDiseaseName} ${e.primaryDiseaseCode}`, e.doctorName].filter(Boolean).join(" · "),
      status: e.encounterType === "외래" ? "외래" : "회진",
      tone: "void" as const,
    })),
    ...h.exams.map((x) => ({
      key: `x${x.examId}`,
      kind: "검사" as const,
      at: x.performedAt ?? x.requestedAt,
      when: shortDateTime(x.performedAt ?? x.requestedAt),
      content: [x.examName, x.resultValue != null && `${x.resultValue} ${x.unit ?? ""}`.trim()].filter(Boolean).join(" · "),
      status: x.resultFlag ?? x.status,
    })),
    ...h.admissions.map((a) => ({
      key: `a${a.admissionId}`,
      kind: "입원" as const,
      at: a.admittedAt,
      when: `${shortDate(a.admittedAt)}~${a.dischargedAt ? shortDate(a.dischargedAt) : ""}`,
      content: `${a.roomNo}호 · 주치의 ${a.attendingName}`,
      status: a.dischargedAt ? "퇴원" : "입원 중",
      tone: a.dischargedAt ? ("done" as const) : undefined,
    })),
    ...h.payments.map((p) => ({
      key: `p${p.paymentId}`,
      kind: "결제" as const,
      at: p.createdAt,
      when: shortDateTime(p.createdAt),
      content: won(p.amount),
      status: p.status,
    })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

export default function PatientHistoryPage() {
  const patientId = Number(useParams<{ patientId: string }>().patientId);
  const patient = useQuery({ queryKey: memberKeys.patient(patientId), queryFn: () => memberApi.patient(patientId), enabled: patientId > 0 });
  const history = useQuery({ queryKey: memberKeys.history(patientId), queryFn: () => memberApi.history(patientId), enabled: patientId > 0 });
  const [tab, setTab] = useState<"전체" | Kind>("전체");

  if (patient.isError && patient.error instanceof ApiError && patient.error.status === 404) {
    return <EmptyState title="없는 환자번호입니다" action={<Link href="/staff/patients" className="font-semibold text-navy underline underline-offset-4">환자 검색으로</Link>} />;
  }
  const title = patient.data ? `${patient.data.name} ${patientNo(patient.data.patientId)}` : patientNo(patientId);
  const counts: Record<Kind, number> = {
    예약: history.data?.reservations.length ?? 0,
    진료: history.data?.encounters.length ?? 0,
    검사: history.data?.exams.length ?? 0,
    입원: history.data?.admissions.length ?? 0,
    결제: history.data?.payments.length ?? 0,
  };
  const rows = history.data ? toRows(history.data).filter((r) => tab === "전체" || r.kind === tab) : [];

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <Link href={`/staff/patients/${patientId}/edit`} className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-body font-semibold text-navy hover:bg-select-bg">
            정보 수정
          </Link>
        }
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[{ value: "전체" as const, label: "전체" }, ...(Object.keys(counts) as Kind[]).map((k) => ({ value: k, label: `${k} ${counts[k]}` }))]}
        />
      </div>
      {history.isPending ? (
        <Skeleton rows={5} />
      ) : history.isError ? (
        <ErrorState
          title="이력을 불러오지 못했습니다"
          cause="서버가 응답하지 않습니다. 다시 시도하세요. 기본 정보는 환자 목록에서 볼 수 있습니다."
          action={
            <Button variant="secondary" onClick={() => history.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === "전체" ? "아직 이력이 없습니다" : `${tab} 이력이 없습니다`}
          description={tab === "전체" ? "환자가 웹에서 예약하면 여기에 나타납니다." : undefined}
        />
      ) : (
        <table className="w-full table-fixed text-left text-body break-keep">
          <colgroup>
            <col className="w-64" />
            <col className="w-20" />
            <col />
            <col className="w-24" />
          </colgroup>
          <thead className="border-b border-sky text-caption text-ink-sub">
            <tr>
              <th className="px-2 py-2.5 font-semibold">일시</th>
              <th className="px-2 py-2.5 font-semibold">구분</th>
              <th className="px-2 py-2.5 font-semibold">내용</th>
              <th className="px-2 py-2.5 font-semibold">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-skeleton">
                <td className="px-2 py-2.5 font-bold whitespace-nowrap text-ink">{r.when}</td>
                <td className="px-2 py-2.5">{r.kind}</td>
                <td className="px-2 py-2.5">{r.content}</td>
                <td className="px-2 py-2.5">
                  <Chip tone={r.tone}>{r.status}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
