"use client";

/**
 * S4 검사 + S4a 검사 결과·판독 입력 — API 4-1, 4-2, 4-3
 * 탭이 곧 검사상태(요청·시행·완료). 행의 버튼은 항상 바로 다음 단계 하나뿐입니다.
 * 시행 처리는 한 번 누르기(시행일시 = 누른 시각), 완료는 판정·판독소견·판독자(로그인한 의사)가 필수입니다.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { orderApi, orderKeys } from "@/lib/api/order";
import { paymentKeys } from "@/lib/api/payment";
import type { Exam, ExamStatus, ResultFlag } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { shortDate, timeOf, today } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { PatientName } from "@/components/patient-label";
import { Button, Card, Chip, ConfirmDialog, EmptyState, ErrorState, PageHeader, Tabs, cx, selectableRow } from "@/components/ui";

const NEXT_TAB: Record<ExamStatus, ExamStatus> = { 요청: "시행", 시행: "완료", 완료: "완료" };

/** 오늘이면 시각만, 다른 날이면 날짜까지(올해가 아니면 연도도) */
const at = (v: string) => (v.startsWith(today()) ? timeOf(v) : `${shortDate(v)} ${timeOf(v)}`);

export default function LabsPage() {
  const { user } = useAuth();
  const exams = useQuery({ queryKey: orderKeys.exams(), queryFn: () => orderApi.exams() });
  const [tab, setTab] = useState<ExamStatus>("요청");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const perform = useMutation({
    mutationFn: (examId: number) => orderApi.perform(examId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });

  return (
    <>
      <PageHeader title="검사" sub={`${user?.departmentName ?? ""}에서 요청된 검사`} />
      <QueryView query={exams} skeletonRows={5} errorTitle="검사 목록을 불러오지 못했습니다">
        {(all) => {
          const count = (s: ExamStatus) => all.filter((x) => x.status === s).length;
          const list = all.filter((x) => x.status === tab);
          const selected = all.find((x) => x.examId === selectedId && x.status === "시행") ?? null;
          return (
            <div className="flex flex-col gap-4">
              <Tabs
                value={tab}
                onChange={(v) => {
                  setTab(v);
                  setSelectedId(null);
                }}
                items={[
                  { value: "요청", label: `요청 ${count("요청")}` },
                  { value: "시행", label: `시행 ${count("시행")}` },
                  { value: "완료", label: `완료 ${count("완료")}` },
                ]}
              />
              {perform.isError && (
                <ErrorState
                  title="시행 처리하지 못했습니다"
                  cause={perform.error instanceof ApiError && perform.error.code === "INVALID_STATUS" ? "이미 다른 사람이 처리한 검사입니다. 목록을 새로 불러왔습니다." : "잠시 뒤 다시 시도하세요."}
                />
              )}
              {list.length === 0 ? (
                <EmptyState
                  title={`${tab} 상태인 검사가 없습니다`}
                  description={tab !== "완료" && count(NEXT_TAB[tab]) > 0 ? `${NEXT_TAB[tab]} 탭에 할 일이 ${count(NEXT_TAB[tab])}건 있습니다.` : undefined}
                  action={tab !== "완료" && count(NEXT_TAB[tab]) > 0 ? <Button variant="secondary" onClick={() => setTab(NEXT_TAB[tab])}>{NEXT_TAB[tab]} 탭으로</Button> : undefined}
                />
              ) : (
                <div className={cx("grid gap-6", tab === "시행" ? "grid-cols-[1fr_380px]" : "grid-cols-1")}>
                  <ExamTable
                    list={list}
                    tab={tab}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onPerform={(id) => perform.mutate(id)}
                    performingId={perform.isPending ? perform.variables : undefined}
                  />
                  {tab === "시행" &&
                    (selected ? (
                      <ResultPanel key={selected.examId} exam={selected} canComplete={user?.role === "의사"} readerName={user?.name ?? ""} onDone={() => setSelectedId(null)} />
                    ) : (
                      <div className="rounded-xl border border-dashed border-sky bg-white p-6 text-center text-body text-ink-sub">검사를 고르면 결과와 판독을 입력합니다.</div>
                    ))}
                </div>
              )}
            </div>
          );
        }}
      </QueryView>
    </>
  );
}

function ExamTable({
  list,
  tab,
  selectedId,
  onSelect,
  onPerform,
  performingId,
}: {
  list: Exam[];
  tab: ExamStatus;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onPerform: (id: number) => void;
  performingId?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-sky bg-white self-start">
      <table className="w-full text-left text-body">
        <thead className="border-b border-sky bg-page text-caption text-ink-sub">
          <tr>
            <th className="px-4 py-3 font-semibold">환자</th>
            <th className="px-4 py-3 font-semibold">검사</th>
            <th className="px-4 py-3 font-semibold">분류</th>
            <th className="px-4 py-3 font-semibold">{tab === "요청" ? "요청" : tab === "시행" ? "시행" : "판독"}</th>
            <th className="px-4 py-3 font-semibold">{tab === "완료" ? "판정" : <span className="sr-only">작업</span>}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => (
            <tr
              key={x.examId}
              // 결과 입력(S4a)은 시행 탭에서만 고름
              {...(tab === "시행" ? selectableRow(x.examId === selectedId, () => onSelect(x.examId), "last:border-0") : { className: "border-b border-skeleton last:border-0" })}
            >
              <td className="px-4 py-3">
                <PatientName patient={x.patient} compact />
              </td>
              <td className="px-4 py-3 text-item">
                <span className="font-semibold">{x.examCode}</span> {x.examName}
              </td>
              <td className="px-4 py-3">{x.category}</td>
              <td className="px-4 py-3 text-ink-sub">
                {tab === "요청" && `${at(x.requestedAt)} ${x.requestDoctorName}`}
                {tab === "시행" && x.performedAt && at(x.performedAt)}
                {tab === "완료" && `${x.performedAt ? shortDate(x.performedAt) : ""} ${x.readerName ?? ""}`}
              </td>
              <td className="px-4 py-3 text-right">
                {tab === "요청" && (
                  <Button variant="secondary" className="h-9" disabled={performingId === x.examId} onClick={() => onPerform(x.examId)}>
                    {performingId === x.examId ? "처리 중…" : "시행 처리"}
                  </Button>
                )}
                {tab === "완료" && x.resultFlag && <Chip>{x.resultFlag}</Chip>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 참고치 "4.0~10.0"을 해석해 범위 밖이면 '이상'을 제안. 해석이 안 되면 제안하지 않음 */
function suggestFlag(range: string | null, value: string): ResultFlag | null {
  const m = range?.match(/^\s*(-?[\d.]+)\s*~\s*(-?[\d.]+)\s*$/);
  const v = Number(value);
  if (!m || value.trim() === "" || Number.isNaN(v)) return null;
  return v < Number(m[1]) || v > Number(m[2]) ? "이상" : "정상";
}

function ResultPanel({ exam, canComplete, readerName, onDone }: { exam: Exam; canComplete: boolean; readerName: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const isBlood = exam.category === "혈액";
  const [value, setValue] = useState("");
  const [flag, setFlag] = useState<ResultFlag | null>(null);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const suggested = isBlood ? suggestFlag(exam.referenceRange, value) : null;
  const effectiveFlag = flag ?? suggested;

  const complete = useMutation({
    mutationFn: () => orderApi.complete(exam.examId, { resultValue: isBlood && value.trim() ? Number(value) : null, resultFlag: effectiveFlag!, readingNote: note.trim() }),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      onDone();
    },
    onError: () => setConfirming(false),
  });
  const fieldErrors = complete.error instanceof ApiError && complete.error.code === "VALIDATION_FAILED" ? complete.error.fieldMap() : {};
  const takenBy = complete.error instanceof ApiError && complete.error.code === "INVALID_STATUS" ? (complete.error.details?.readerName as string | undefined) : undefined;

  return (
    <Card className="flex flex-col gap-4 self-start">
      <div>
        <p className="text-title font-bold text-ink">
          {exam.examCode} {exam.examName}
        </p>
        <p className="text-caption text-ink-sub">
          {exam.patient.name} · {exam.category}
          {exam.referenceRange && ` · 참고치 ${exam.referenceRange} ${exam.unit ?? ""}`}
          {exam.performedAt && ` · 시행 ${at(exam.performedAt)}`}
        </p>
      </div>

      {!canComplete ? (
        <p className="rounded-lg bg-neutral-bg px-3 py-2 text-body text-ink-sub">결과와 판독 입력(완료 처리)은 의사가 합니다.</p>
      ) : (
        <>
          {takenBy !== undefined || (complete.error instanceof ApiError && complete.error.code === "INVALID_STATUS") ? (
            <ErrorState title="이미 판독된 검사입니다" cause={`${takenBy ?? "다른 의사"} 의사가 먼저 완료했습니다. 입력하던 소견은 아래에 남아 있으니 필요하면 복사하세요.`} />
          ) : complete.isError && !Object.keys(fieldErrors).length ? (
            <ErrorState title="완료 처리하지 못했습니다" cause="입력한 내용은 그대로 있으니 잠시 뒤 다시 시도하세요." />
          ) : null}

          {/* 영상·기능 검사는 결과값 칸이 없음 */}
          {isBlood && (
            <label className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-ink-sub">결과값{exam.unit ? ` (${exam.unit})` : ""}</span>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={cx("h-11 rounded-lg border bg-white px-3 text-item outline-none focus:border-navy", fieldErrors.resultValue ? "border-warn" : "border-line/60")}
              />
              {fieldErrors.resultValue && <span className="text-caption text-error-ink">{fieldErrors.resultValue}</span>}
            </label>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-ink-sub">판정 (필수){suggested && !flag && " · 참고치로 미리 고름"}</span>
            <div className="grid grid-cols-2 gap-2">
              {(["정상", "이상"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={effectiveFlag === f}
                  onClick={() => setFlag(f)}
                  className={cx(
                    "h-10 rounded-lg border text-item",
                    effectiveFlag === f ? (f === "이상" ? "border-warn bg-warn-bg font-bold text-error-ink" : "border-positive bg-positive-bg font-bold text-positive") : "border-line/60 bg-white",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-ink-sub">판독 소견 (필수)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={isBlood ? 3 : 6}
              className={cx("rounded-lg border bg-white px-3 py-2 text-item outline-none focus:border-navy", fieldErrors.readingNote ? "border-warn" : "border-line/60")}
            />
          </label>

          <p className="text-caption text-ink-sub">판독자: {readerName} (로그인한 의사)</p>
          <Button disabled={!effectiveFlag || !note.trim()} onClick={() => setConfirming(true)}>
            완료 처리
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title="완료 처리할까요?"
        confirmLabel="완료 처리"
        pending={complete.isPending}
        onConfirm={() => complete.mutate()}
        onCancel={() => setConfirming(false)}
      >
        완료하면 결과가 환자에게 바로 공개되고, 이후에는 고칠 수 없습니다.
      </ConfirmDialog>
    </Card>
  );
}
