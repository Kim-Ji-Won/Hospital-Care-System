"use client";

/**
 * P5 검사 결과 — API 4-4
 * 판독이 끝난('완료') 검사만 보여 줍니다. 수치가 있으면 참고치 막대로 범위 안팎을 보여 주고,
 * 영상·기능 검사처럼 수치가 없으면 판독 소견을 본문으로 올립니다. 판독 시각 컬럼이 없어 날짜는 시행일시입니다.
 */
import { useQuery } from "@tanstack/react-query";
import { orderApi, orderKeys } from "@/lib/api/order";
import type { MyExam } from "@/lib/api/types";
import { shortDate } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Chip, PageHeader, cx } from "@/components/ui";

export default function ResultsPage() {
  const exams = useQuery({ queryKey: orderKeys.mine(), queryFn: orderApi.mine });

  return (
    <>
      <PageHeader title="검사 결과" sub="판독이 끝난 검사만 보입니다." />
      <QueryView
        query={exams}
        skeletonRows={3}
        errorTitle="검사 결과를 불러오지 못했습니다"
        empty={{ title: "볼 수 있는 검사 결과가 없습니다", description: "검사를 받았다면 판독이 끝난 뒤 여기에 나타납니다." }}
      >
        {(list) => (
          <div className="overflow-hidden rounded-xl border border-sky bg-white">
            <table className="w-full text-left text-body">
              <thead className="border-b border-sky bg-page text-caption text-ink-sub">
                <tr>
                  <th className="px-5 py-3 font-semibold">검사</th>
                  <th className="px-5 py-3 font-semibold">결과</th>
                  <th className="w-56 px-5 py-3 font-semibold">참고치 대비</th>
                  <th className="px-5 py-3 font-semibold">판정</th>
                  <th className="px-5 py-3 font-semibold">판독 소견</th>
                  <th className="px-5 py-3 font-semibold">판독</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.examId} className="border-b border-skeleton align-top last:border-0">
                    <td className="px-5 py-4 text-item font-semibold">{x.examName}</td>
                    <td className="px-5 py-4">
                      {x.resultValue != null ? (
                        <span className="text-item font-semibold">
                          {x.resultValue.toFixed(2).replace(/\.?0+$/, "")} <span className="text-caption font-normal text-ink-sub">{x.unit}</span>
                        </span>
                      ) : (
                        <span className="text-caption text-ink-sub">수치 없음</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {x.resultValue != null && x.referenceRange ? <RangeBar exam={x} /> : <span className="text-caption text-ink-sub">{x.category} 검사</span>}
                    </td>
                    <td className="px-5 py-4">{x.resultFlag === "이상" ? <Chip>이상</Chip> : <Chip tone="done">정상</Chip>}</td>
                    <td className={cx("px-5 py-4", x.resultValue == null ? "text-item" : "text-body")}>{x.readingNote}</td>
                    <td className="px-5 py-4 text-caption text-ink-sub">
                      {shortDate(x.performedAt)}
                      <br />
                      {x.readerName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryView>
    </>
  );
}

/** 참고치 "4.0~10.0"과 결과값을 한 축에. 범위 밖이면 표시가 주황 */
function RangeBar({ exam }: { exam: MyExam }) {
  const m = exam.referenceRange!.match(/^\s*(-?[\d.]+)\s*~\s*(-?[\d.]+)\s*$/);
  if (!m) return <span className="text-caption text-ink-sub">참고치 {exam.referenceRange}</span>;
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  const span = hi - lo || 1;
  // 축: 참고치 양쪽으로 범위의 50%씩 여유
  const min = lo - span * 0.5;
  const max = hi + span * 0.5;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;
  const out = exam.resultValue! < lo || exam.resultValue! > hi;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2 rounded-full bg-skeleton">
        <div className="absolute inset-y-0 rounded-full bg-sky" style={{ left: pos(lo), right: `calc(100% - ${pos(hi)})` }} />
        <div className={cx("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white", out ? "bg-warn" : "bg-navy")} style={{ left: pos(exam.resultValue!) }} />
      </div>
      <span className="text-caption text-ink-sub">참고치 {exam.referenceRange}</span>
    </div>
  );
}
