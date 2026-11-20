"use client";

/**
 * P4 진료 기록 — API 3-2
 * 진료 한 건 안에 진단·소견·처방·검사를 묶어 "그날 무슨 일이 있었나"로 보여 줍니다.
 * 왼쪽 목록에서 고른 진료가 오른쪽에 진단 → 소견 → 처방 → 검사 순서로 열립니다.
 */
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { encounterApi, encounterKeys } from "@/lib/api/encounter";
import type { EncounterDetail } from "@/lib/api/types";
import { shortDate } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Card, Chip, PageHeader, cx } from "@/components/ui";

const typeLabel = (e: EncounterDetail) => `${e.departmentName} ${e.encounterType === "외래" ? "외래" : "입원 회진"}`;

export default function RecordsPage() {
  const encounters = useQuery({ queryKey: encounterKeys.mine(), queryFn: encounterApi.mine });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <>
      <PageHeader title="진료 기록" />
      <QueryView
        query={encounters}
        skeletonRows={5}
        errorTitle="진료 기록을 불러오지 못했습니다"
        empty={{
          title: "아직 진료 기록이 없습니다",
          description: "진료를 받으면 진단, 소견, 처방이 여기에 남습니다. 기록은 사라지지 않습니다.",
          action: <Link href="/book" className="font-semibold text-navy underline underline-offset-4">진료 예약하기</Link>,
        }}
      >
        {(list) => {
          const selected = list.find((e) => e.encounterId === selectedId) ?? list[0];
          return (
            <div className="grid grid-cols-[360px_1fr] gap-6">
              <ul className="flex flex-col self-start overflow-hidden rounded-xl border border-sky bg-white">
                {list.map((e) => (
                  <li key={e.encounterId} className="border-b border-skeleton last:border-0">
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.encounterId)}
                      aria-current={e.encounterId === selected.encounterId}
                      className={cx("flex w-full items-center justify-between px-4 py-3 text-left hover:bg-page", e.encounterId === selected.encounterId && "bg-select-bg hover:bg-select-bg")}
                    >
                      <span className="flex flex-col">
                        <span className="text-item font-semibold">{shortDate(e.encounterAt)}</span>
                        <span className="text-caption text-ink-sub">{typeLabel(e)}</span>
                      </span>
                      <span className="text-body text-ink-sub">{e.doctorName}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <EncounterView encounter={selected} />
            </div>
          );
        }}
      </QueryView>
    </>
  );
}

function EncounterView({ encounter: e }: { encounter: EncounterDetail }) {
  return (
    <Card className="flex flex-col gap-5 self-start">
      <div>
        <p className="text-title font-bold text-ink">
          {shortDate(e.encounterAt)} {typeLabel(e)}
        </p>
        <p className="text-caption text-ink-sub">담당의 {e.doctorName}</p>
      </div>

      <section>
        <p className="mb-2 text-caption font-semibold text-ink-sub">진단</p>
        {e.diagnoses.length === 0 ? (
          <p className="text-body text-ink-sub">진단 없음</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {e.diagnoses.map((d) => (
              <li key={d.diseaseCode} className="flex items-center gap-2 text-item">
                {d.diseaseName} <span className="text-caption text-ink-sub">{d.diseaseCode}</span>
                {d.isPrimary && <Chip>주진단</Chip>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-2 text-caption font-semibold text-ink-sub">소견</p>
        <p className="text-item">{e.finding}</p>
      </section>

      <section>
        <p className="mb-2 text-caption font-semibold text-ink-sub">처방</p>
        {e.prescriptions.length === 0 ? (
          <p className="text-body text-ink-sub">처방 없음</p>
        ) : (
          e.prescriptions.map((p) => (
            <div key={p.prescriptionId} className="mb-2 rounded-lg bg-page p-3">
              <p className="mb-1.5 text-caption font-semibold text-ink-sub">{p.dispenseType === "원외" ? "원외 · 약국에서 받기" : "원내 · 병원에서 받기"}</p>
              <ul className="flex flex-col gap-2">
                {p.items.map((i) => (
                  <li key={i.drugCode}>
                    <p className="text-item font-semibold">{i.drugName}</p>
                    {/* 약 봉투 표기 순서: 1회량 × 횟수 × 일수, 용법은 아래 줄 */}
                    <p className="text-body">
                      {i.dose}
                      {i.unit} × {i.timesPerDay}회 × {i.durationDays}일
                    </p>
                    <p className="text-caption text-ink-sub">{i.instruction}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-caption font-semibold text-ink-sub">검사</p>
          {/* 결과는 P5 한 화면에 모여 있으므로 링크는 하나만 */}
          {e.exams.length > 0 && (
            <Link href="/results" className="text-body font-semibold text-navy hover:underline">
              결과 보기 ›
            </Link>
          )}
        </div>
        {e.exams.length === 0 ? (
          <p className="text-body text-ink-sub">판독이 끝난 검사 없음</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {e.exams.map((x) => (
              <li key={x.examId} className="text-item">
                {x.examName}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
