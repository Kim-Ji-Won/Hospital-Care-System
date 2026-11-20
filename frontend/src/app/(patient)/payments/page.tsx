"use client";

/**
 * P6 결제 내역 — API 6-3
 * 조회 전용입니다. 수납은 원무과 창구에서 합니다. 금액은 합계와 포함 목록만 보여 주고 항목별 금액은 없습니다.
 * 취소 행은 같은 진료에 결제가 2건 보이는 이유를 적어 이중 청구로 오해하지 않게 합니다.
 * 입원 중 안내(5-7)는 2순위에서 붙입니다.
 */
import { useQuery } from "@tanstack/react-query";
import { paymentApi, paymentKeys } from "@/lib/api/payment";
import { shortDateTime, won } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { includesText, paymentTitle } from "@/components/payment-text";
import { Card, Chip, PageHeader } from "@/components/ui";

export default function PaymentsPage() {
  const payments = useQuery({ queryKey: paymentKeys.mine(), queryFn: paymentApi.mine });

  return (
    <>
      <PageHeader title="결제 내역" sub="1층 원무과 창구에서 카드, 현금, 계좌이체로 수납할 수 있어요." />
      <QueryView
        query={payments}
        skeletonRows={4}
        errorTitle="결제 내역을 불러오지 못했습니다"
        empty={{ title: "아직 청구된 진료비가 없습니다", description: "진료비는 진료가 끝나면(입원은 퇴원하면) 자동으로 청구됩니다." }}
      >
        {(list) => {
          const unpaid = list.filter((p) => p.status === "미결제");
          return (
            <div className="flex flex-col gap-6">
              {unpaid.map((p) => (
                <Card key={p.paymentId} className="flex items-center justify-between gap-6 border-navy/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <Chip>미결제</Chip>
                      <p className="text-item font-semibold">{paymentTitle(p)}</p>
                    </div>
                    <p className="mt-1.5 text-body text-ink-sub">포함: {includesText(p)}</p>
                    <p className="text-caption text-ink-sub">청구 {shortDateTime(p.createdAt)}</p>
                  </div>
                  <p className="text-step font-bold text-navy">{won(p.amount)}</p>
                </Card>
              ))}

              <div className="overflow-hidden rounded-xl border border-sky bg-white">
                <table className="w-full text-left text-body">
                  <thead className="border-b border-sky bg-page text-caption text-ink-sub">
                    <tr>
                      <th className="px-5 py-3 font-semibold">진료</th>
                      <th className="px-5 py-3 font-semibold">금액</th>
                      <th className="px-5 py-3 font-semibold">수단</th>
                      <th className="px-5 py-3 font-semibold">일시</th>
                      <th className="px-5 py-3 font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.paymentId} className="border-b border-skeleton last:border-0">
                        <td className="px-5 py-3.5">
                          <p className="text-item">{paymentTitle(p)}</p>
                          <p className="text-caption text-ink-sub">{includesText(p)}</p>
                        </td>
                        <td className="px-5 py-3.5 text-item font-semibold">{won(p.amount)}</td>
                        <td className="px-5 py-3.5">{p.method ?? "-"}</td>
                        <td className="px-5 py-3.5 text-ink-sub">{p.paidAt ? shortDateTime(p.paidAt) : `청구 ${shortDateTime(p.createdAt)}`}</td>
                        <td className="px-5 py-3.5">
                          <Chip>{p.status}</Chip>
                          {p.status === "취소" && <p className="mt-1 text-caption text-ink-sub">다시 청구되어 취소됨</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }}
      </QueryView>
    </>
  );
}
