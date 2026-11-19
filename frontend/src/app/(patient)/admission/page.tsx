"use client";

/**
 * P1a 입원 내역 — API 5-7
 * 지금 입원의 병실·주치의·퇴원 예정일과 회진 내용, 그리고 지난 입원을 봅니다. 홈의 입원 카드에서 들어옵니다.
 * 입원 중에는 결제가 아직 없어 결제 내역이 비어 보이므로, 청구 시점을 먼저 알려 줍니다.
 */
import { useQuery } from "@tanstack/react-query";
import { admissionApi, admissionKeys } from "@/lib/api/admission";
import type { MyAdmission } from "@/lib/api/types";
import { shortDate, shortDateTime } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { InpatientNotice } from "@/components/inpatient";
import { Chip, PageHeader } from "@/components/ui";

export default function AdmissionPage() {
  const admissions = useQuery({ queryKey: admissionKeys.mine(), queryFn: admissionApi.mine });

  return (
    <>
      <PageHeader title="입원 내역" />
      <QueryView
        query={admissions}
        skeletonRows={4}
        errorTitle="입원 내역을 불러오지 못했습니다"
        empty={{ title: "입원 내역이 없어요", description: "입원하면 병실, 주치의, 퇴원 예정일과 회진 내용을 여기서 볼 수 있어요." }}
      >
        {(list) => {
          const current = list.find((a) => !a.dischargedAt);
          const past = list.filter((a) => a.dischargedAt);
          return (
            <div className={current ? "grid grid-cols-[300px_1fr] gap-6" : ""}>
              {current && (
                <div className="flex flex-col gap-3 self-start">
                  <CurrentCard admission={current} />
                  <InpatientNotice />
                </div>
              )}
              <div className="flex flex-col gap-6">
                {current && <Rounds admission={current} />}
                {past.length > 0 && <PastAdmissions list={past} />}
              </div>
            </div>
          );
        }}
      </QueryView>
    </>
  );
}

function CurrentCard({ admission: a }: { admission: MyAdmission }) {
  return (
    <div className="rounded-2xl border border-sky bg-select-bg px-5 py-4">
      <Chip>입원 중</Chip>
      <p className="mt-2 text-step font-bold text-ink">
        {a.roomNo}호 · {a.ward}
      </p>
      <p className="text-body text-ink-sub">
        주치의 {a.attendingName} · 입원 {shortDate(a.admittedAt)} · 퇴원 예정 {a.expectedDischargeDate ? shortDate(a.expectedDischargeDate) : "미정"}
      </p>
      <p className="mt-4 text-item text-ink">{a.reason}</p>
    </div>
  );
}

function Rounds({ admission: a }: { admission: MyAdmission }) {
  return (
    <section>
      <h2 className="mb-2 text-body font-bold text-ink-sub">회진 기록</h2>
      {a.rounds.length === 0 ? (
        <p className="rounded-xl border border-sky bg-white px-5 py-4 text-body text-ink-sub">아직 회진 기록이 없어요. 회진이 끝나면 여기에 쌓여요.</p>
      ) : (
        <table className="w-full table-fixed text-left text-body break-keep">
          <colgroup>
            <col className="w-48" />
            <col className="w-32" />
            <col />
          </colgroup>
          <thead className="border-b border-sky text-caption text-ink-sub">
            <tr>
              <th className="px-2 py-2.5 font-semibold">일시</th>
              <th className="px-2 py-2.5 font-semibold">의사</th>
              <th className="px-2 py-2.5 font-semibold">소견</th>
            </tr>
          </thead>
          <tbody>
            {a.rounds.map((r) => (
              <tr key={r.encounterAt} className="border-b border-skeleton">
                <td className="px-2 py-2.5 font-bold whitespace-nowrap text-ink">{shortDateTime(r.encounterAt)}</td>
                <td className="px-2 py-2.5">{r.doctorName}</td>
                <td className="px-2 py-2.5">{r.finding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PastAdmissions({ list }: { list: MyAdmission[] }) {
  return (
    <section>
      <h2 className="mb-2 text-body font-bold text-ink-sub">지난 입원</h2>
      <table className="w-full table-fixed text-left text-body break-keep">
        <colgroup>
          <col />
          <col className="w-40" />
          <col className="w-40" />
        </colgroup>
        <thead className="border-b border-sky text-caption text-ink-sub">
          <tr>
            <th className="px-2 py-2.5 font-semibold">기간</th>
            <th className="px-2 py-2.5 font-semibold">병실</th>
            <th className="px-2 py-2.5 font-semibold">주치의</th>
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.admissionId} className="border-b border-skeleton">
              <td className="px-2 py-2.5 font-bold text-ink">
                {shortDate(a.admittedAt)}~{shortDate(a.dischargedAt!)}
                <span className="ml-2 font-normal text-ink-sub">{a.reason}</span>
              </td>
              <td className="px-2 py-2.5">{a.roomNo}호</td>
              <td className="px-2 py-2.5">{a.attendingName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
