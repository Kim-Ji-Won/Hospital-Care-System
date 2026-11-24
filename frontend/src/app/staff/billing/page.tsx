"use client";

/**
 * S6 수납 + S6b 결제 취소 — API 1-6, 6-1, 6-2, 6-4
 * 원무 직원이 환자번호로 환자를 찾고, 자동으로 만들어진 '미결제' 결제를 수단을 골라 '완료'로 바꿉니다.
 * 금액은 만들거나 고치지 않고, 저장된 합계와 포함 목록만 보여 줍니다. 완료 탭에서 결제를 취소하면(S6b, 6-4) 취소 건은 남고 같은 진료에 새 미결제가 생깁니다.
 */
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { memberApi, memberKeys } from "@/lib/api/member";
import { paymentApi, paymentKeys } from "@/lib/api/payment";
import type { Payment, PaymentMethod, PaymentStatus } from "@/lib/api/types";
import { shortDate, shortDateTime, won } from "@/lib/date";
import { includesText, paymentTitle } from "@/components/payment-text";
import { patientLine } from "@/components/patient-label";
import { Button, Card, Chip, ConfirmDialog, EmptyState, ErrorState, PageHeader, Skeleton, Tabs, cx, selectableRow } from "@/components/ui";

const METHODS: PaymentMethod[] = ["카드", "현금", "계좌이체"];

export default function BillingPage() {
  const [input, setInput] = useState("");
  const [patientId, setPatientId] = useState<number | null>(null);

  function search(e: FormEvent) {
    e.preventDefault();
    const id = Number(input.replace(/[^0-9]/g, ""));
    if (id > 0) setPatientId(id);
  }

  return (
    <>
      <PageHeader title="수납" />
      <form onSubmit={search} className="mb-6 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="numeric"
          placeholder="환자번호로 조회 (예: 10234)"
          className="h-11 w-72 rounded-lg border border-line/60 bg-white px-3 text-item outline-none focus:border-navy"
        />
        <Button type="submit" disabled={!input.trim()}>
          조회
        </Button>
      </form>
      {patientId ? (
        <PatientBilling key={patientId} patientId={patientId} />
      ) : (
        <EmptyState title="환자번호를 입력하세요" description="환자번호는 웹 회원가입 때 자동으로 받은 번호입니다. 환자의 내 정보 화면에서 확인할 수 있습니다." />
      )}
    </>
  );
}

function PatientBilling({ patientId }: { patientId: number }) {
  const patient = useQuery({ queryKey: memberKeys.patient(patientId), queryFn: () => memberApi.patient(patientId) });
  const payments = useQuery({ queryKey: paymentKeys.byPatient(patientId), queryFn: () => paymentApi.byPatient(patientId) });
  const [tab, setTab] = useState<PaymentStatus>("미결제");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (patient.isPending || payments.isPending) return <Skeleton rows={4} />;
  if (patient.isError) {
    const notFound = patient.error instanceof ApiError && patient.error.status === 404;
    return (
      <ErrorState
        title={notFound ? `환자번호 ${patientId}인 환자가 없습니다` : "환자를 불러오지 못했습니다"}
        cause={notFound ? "번호를 다시 확인하세요. 번호를 모르면 환자 메뉴에서 이름이나 연락처로 찾을 수 있습니다." : "잠시 뒤 다시 시도하세요."}
      />
    );
  }
  if (payments.isError) return <ErrorState title="결제 내역을 불러오지 못했습니다" cause="잠시 뒤 다시 시도하세요." action={<Button variant="secondary" onClick={() => payments.refetch()}>다시 시도</Button>} />;

  const p = patient.data;
  const all = payments.data;
  const count = (s: PaymentStatus) => all.filter((x) => x.status === s).length;
  const list = all.filter((x) => x.status === tab);
  const selected = list.find((x) => x.paymentId === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-select-bg">
        <p className="text-title font-bold text-ink">{p.name}</p>
        <p className="text-body text-ink-sub">{patientLine(p)}</p>
        <p className="text-body text-ink-sub">{p.phone.replace(/-(\d+)-/, "-****-")}</p>
        {p.currentAdmission && (
          <p className="flex items-center gap-2 text-body text-ink">
            <Chip>입원 중</Chip>
            {p.currentAdmission.roomNo}호 · {shortDate(p.currentAdmission.admittedAt)} 입원. 입원 진료비는 퇴원 처리 때 한 번에 청구됩니다.
          </p>
        )}
      </Card>
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSelectedId(null);
        }}
        items={[
          { value: "미결제", label: `미결제 ${count("미결제")}` },
          { value: "완료", label: `완료 ${count("완료")}` },
          { value: "취소", label: `취소 ${count("취소")}` },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState
          title={tab === "미결제" ? "낼 진료비가 없습니다" : `${tab}된 결제가 없습니다`}
          description={tab === "미결제" ? "진료비는 진료 기록을 저장할 때(입원은 퇴원 처리 때) 자동으로 만들어집니다." : undefined}
        />
      ) : (
        <div className="grid grid-cols-[1fr_360px] gap-6">
          <PaymentTable list={list} selectedId={selectedId} onSelect={setSelectedId} />
          {selected ? (
            <PaymentPanel
              key={selected.paymentId}
              payment={selected}
              patientId={patientId}
              patientName={p.name}
              onDone={() => setSelectedId(null)}
              onCancelled={(newId) => {
                // 새로 생긴 미결제 건으로 안내
                setTab("미결제");
                setSelectedId(newId);
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-sky bg-white p-6 text-center text-body text-ink-sub">결제를 고르면 포함 내역과 수납이 여기에 보입니다.</div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentTable({ list, selectedId, onSelect }: { list: Payment[]; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="self-start overflow-hidden rounded-xl border border-sky bg-white">
      <table className="w-full text-left text-body">
        <thead className="border-b border-sky bg-page text-caption text-ink-sub">
          <tr>
            <th className="px-4 py-3 font-semibold">진료</th>
            <th className="px-4 py-3 font-semibold">금액</th>
            <th className="px-4 py-3 font-semibold">생성</th>
            <th className="px-4 py-3 font-semibold">상태</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => (
            <tr
              key={x.paymentId}
              {...selectableRow(x.paymentId === selectedId, () => onSelect(x.paymentId), "last:border-0")}
            >
              <td className="px-4 py-3 text-item">{paymentTitle(x)}</td>
              <td className="px-4 py-3 text-item font-semibold">{won(x.amount)}</td>
              <td className="px-4 py-3 text-ink-sub">{shortDateTime(x.createdAt)}</td>
              <td className="px-4 py-3">
                <Chip>{x.status}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentPanel({
  payment,
  patientId,
  patientName,
  onDone,
  onCancelled,
}: {
  payment: Payment;
  patientId: number;
  patientName: string;
  onDone: () => void;
  onCancelled: (newPaymentId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [confirming, setConfirming] = useState(false);
  const cancel = useMutation({
    mutationFn: () => paymentApi.cancel(payment.paymentId),
    onSuccess: (result) => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      onCancelled(result.newPayment.paymentId);
    },
    onError: (e) => {
      // 이미 취소된 결제면 목록을 새로 받아 새 미결제 건을 보게 함
      if (e instanceof ApiError && e.code === "INVALID_STATUS") queryClient.invalidateQueries({ queryKey: paymentKeys.all });
    },
  });
  const pay = useMutation({
    mutationFn: () => paymentApi.pay(payment.paymentId, method!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.byPatient(patientId) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.mine() });
      onDone();
    },
  });

  return (
    <Card className="flex flex-col gap-4 self-start">
      <div>
        <p className="text-caption font-semibold text-ink-sub">포함</p>
        <p className="mt-1 text-body text-ink">{includesText(payment)}</p>
      </div>
      <div className="flex items-baseline justify-between border-t border-skeleton pt-3">
        <p className="text-body text-ink-sub">청구 금액</p>
        <p className="text-step font-bold text-navy">{won(payment.amount)}</p>
      </div>

      {payment.status === "미결제" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-ink-sub">결제 수단</span>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                  className={cx("h-10 rounded-lg border text-item", method === m ? "border-navy bg-navy font-bold text-white" : "border-line/60 bg-white hover:bg-select-bg")}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {pay.isError && (
            <ErrorState
              title="수납하지 못했습니다"
              cause={pay.error instanceof ApiError && pay.error.code === "INVALID_STATUS" ? "이미 수납된 결제입니다. 목록을 새로 불러오세요." : "잠시 뒤 다시 시도하세요."}
            />
          )}
          <Button className="h-11" disabled={!method || pay.isPending} onClick={() => pay.mutate()}>
            {pay.isPending ? "수납하는 중…" : "수납 완료"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-body text-ink-sub">
            {payment.method} · {payment.paidAt ? shortDateTime(payment.paidAt) : ""}
            {payment.status === "취소" && " · 다시 청구되어 취소됨"}
          </p>
          {payment.status === "완료" && (
            <Button
              variant="secondary"
              onClick={() => {
                cancel.reset();
                setConfirming(true);
              }}
            >
              결제 취소
            </Button>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title="이 결제를 취소할까요?"
        confirmLabel="결제 취소"
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          {patientName} · {paymentTitle(payment)} · {won(payment.amount)} ({payment.method})
        </p>
        <p>취소한 결제는 기록으로 남고, 같은 진료에 지금 단가로 계산한 새 미결제 결제가 만들어집니다.</p>
        {cancel.isError && (
          <p className="mt-2 text-error-ink">
            {cancel.error instanceof ApiError && cancel.error.code === "INVALID_STATUS"
              ? "이미 취소된 결제입니다. 미결제 탭에서 새로 생긴 결제를 확인하세요."
              : "취소하지 못했습니다. 잠시 뒤 다시 시도하세요."}
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}
