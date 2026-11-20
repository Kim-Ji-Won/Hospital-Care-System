"use client";

/**
 * 진료 기록 입력 부품 — S2 진료 기록 작성(외래)과 S2b 회진 기록이 함께 씁니다.
 * S2a 추가 패널은 질병·약품·검사를 검색해 목록에서 고르기만 합니다(FK).
 */
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { orderApi, orderKeys } from "@/lib/api/order";
import type { DispenseType, Drug } from "@/lib/api/types";
import { won } from "@/lib/date";
import { Button, Card, EmptyState, ErrorState, Skeleton, Tabs, cx } from "@/components/ui";

export interface DrugDraft {
  drugCode: string;
  name: string;
  unit: string;
  dose: number;
  timesPerDay: number;
  durationDays: number;
  instruction: string;
}
export interface ExamDraft {
  examCode: string;
  name: string;
  fee: number;
}
export type Adding = null | "disease" | "drug" | "exam";

export function textareaClass(error: boolean) {
  return cx("w-full rounded-xl border bg-white px-4 py-3 text-item outline-none focus:border-navy", error ? "border-warn" : "border-line/60");
}

export function Field({ label, error, extra, children }: { label: string; error?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  // 이름표를 입력칸과 이어 화면 읽기 프로그램이 칸 이름을 읽게 함 (옆의 "특이 소견 없음" 버튼은 이름표 밖에 둠)
  const id = useId();
  const errorId = `${id}-error`;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>, { id, "aria-describedby": error ? errorId : undefined, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-body font-semibold text-ink-sub">
          {label}
        </label>
        {extra}
      </div>
      {control}
      {error && (
        <span id={errorId} className="text-caption text-error-ink">
          {error}
        </span>
      )}
    </div>
  );
}

export function Section({ title, error, onAdd, addLabel, children }: { title: string; error?: string; onAdd?: () => void; addLabel?: string; children: React.ReactNode }) {
  return (
    <section className={cx("rounded-xl border bg-white p-4", error ? "border-warn" : "border-sky")}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-item font-semibold text-ink">{title}</p>
        {onAdd && (
          <button type="button" onClick={onAdd} className="text-body font-semibold text-navy hover:underline">
            {addLabel}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
      {error && <p className="mt-2 text-caption text-error-ink">{error}</p>}
    </section>
  );
}

export function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-page px-3 py-2">
      <div className="flex flex-1 items-center justify-between gap-3">{children}</div>
      <button type="button" onClick={onRemove} aria-label="빼기" className="text-ink-sub hover:text-navy">
        ×
      </button>
    </div>
  );
}

/** S2a: 질병·약품·검사를 검색해 넣는 오른쪽 패널. 목록에서 고르기만 가능(FK) */
export function AddPanel({
  mode,
  showFees = true,
  dispenseTypes = ["원외", "원내"],
  dispenseType,
  onDispenseType,
  added,
  onAddDisease,
  onAddDrug,
  onAddExam,
  onClose,
}: {
  mode: Exclude<Adding, null>;
  /** 회진(S2b)은 금액을 보이지 않음 (퇴원 때 입원 청구에 합산) */
  showFees?: boolean;
  /** 고를 수 있는 처방구분. 회진은 원내만이라 탭을 숨김 */
  dispenseTypes?: DispenseType[];
  dispenseType: DispenseType;
  onDispenseType: (t: DispenseType) => void;
  added: Record<"disease" | "drug" | "exam", string[]>;
  onAddDisease: (code: string, name: string) => void;
  onAddDrug: (item: DrugDraft) => void;
  onAddExam: (x: ExamDraft) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [drug, setDrug] = useState<Drug | null>(null);
  // 버튼으로 패널을 열었으니 검색칸으로 포커스를 옮김
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => searchRef.current?.focus(), [mode]);
  const diseases = useQuery({ queryKey: orderKeys.diseases(q), queryFn: () => orderApi.diseases(q), enabled: mode === "disease" });
  const drugs = useQuery({ queryKey: orderKeys.drugs(q), queryFn: () => orderApi.drugs(q), enabled: mode === "drug" });
  const examItems = useQuery({ queryKey: orderKeys.examItems(q), queryFn: () => orderApi.examItems(q), enabled: mode === "exam" });
  const title = mode === "disease" ? "진단 추가" : mode === "drug" ? "약품 추가" : "검사 추가";
  const placeholder = mode === "disease" ? "질병명, 코드로 검색" : mode === "drug" ? "약품명, 코드, 성분으로 검색" : "검사명, 코드로 검색";
  const active = mode === "disease" ? diseases : mode === "drug" ? drugs : examItems;

  return (
    <Card className="flex flex-col gap-4 self-start">
      <div className="flex items-center justify-between">
        <p className="text-item font-semibold">{title}</p>
        <Button variant="ghost" className="h-8 px-2" onClick={onClose}>
          닫기
        </Button>
      </div>
      {mode === "drug" && dispenseTypes.length > 1 && (
        <Tabs
          value={dispenseType}
          onChange={onDispenseType}
          items={[
            { value: "원외", label: "원외 (약국)" },
            { value: "원내", label: "원내 (진료비 포함)" },
          ]}
        />
      )}
      <input
        ref={searchRef}
        aria-label={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setDrug(null);
        }}
        placeholder={placeholder}
        className="h-11 rounded-lg border border-line/60 bg-white px-3 text-item outline-none focus:border-navy"
      />
      {active.isPending ? (
        <Skeleton rows={3} />
      ) : active.isError ? (
        <ErrorState title="검색하지 못했습니다" cause="잠시 뒤 다시 시도하세요." />
      ) : (active.data?.length ?? 0) === 0 ? (
        <EmptyState title="검색 결과가 없습니다" description="등록된 항목만 고를 수 있습니다. 없는 항목은 기준 정보에서 먼저 등록해야 합니다." />
      ) : (
        <ul className="flex max-h-80 flex-col overflow-y-auto rounded-lg border border-skeleton">
          {mode === "disease" &&
            diseases.data!.map((d) => (
              <ResultRow key={d.diseaseCode} added={added.disease.includes(d.diseaseCode)} onPick={() => onAddDisease(d.diseaseCode, d.name)}>
                <span>
                  <span className="font-semibold">{d.diseaseCode}</span> {d.name}
                </span>
              </ResultRow>
            ))}
          {mode === "drug" &&
            drugs.data!.map((d) => (
              <ResultRow key={d.drugCode} added={added.drug.includes(d.drugCode)} selected={drug?.drugCode === d.drugCode} onPick={() => setDrug(d)}>
                <span>
                  <span className="font-semibold">{d.drugCode}</span> {d.name} <span className="text-caption text-ink-sub">· {d.form} · {d.unit}</span>
                </span>
                {showFees && <span className="text-caption text-ink-sub">{won(d.unitPrice)}</span>}
              </ResultRow>
            ))}
          {mode === "exam" &&
            examItems.data!.map((x) => (
              <ResultRow key={x.examCode} added={added.exam.includes(x.examCode)} onPick={() => onAddExam({ examCode: x.examCode, name: x.name, fee: x.fee })}>
                <span>
                  <span className="font-semibold">{x.examCode}</span> {x.name} <span className="text-caption text-ink-sub">· {x.category}</span>
                </span>
                {showFees && <span className="text-caption text-ink-sub">{won(x.fee)}</span>}
              </ResultRow>
            ))}
        </ul>
      )}
      {mode === "drug" && drug && !added.drug.includes(drug.drugCode) && (
        <DoseForm
          drug={drug}
          onAdd={(item) => {
            onAddDrug(item);
            setDrug(null);
          }}
        />
      )}
    </Card>
  );
}

function ResultRow({ children, added, selected, onPick }: { children: React.ReactNode; added: boolean; selected?: boolean; onPick: () => void }) {
  return (
    <li className="border-b border-skeleton last:border-0">
      <button
        type="button"
        disabled={added}
        onClick={onPick}
        className={cx("flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-body", selected ? "bg-select-bg" : "hover:bg-page", added && "cursor-not-allowed opacity-60")}
      >
        {children}
        {added && <span className="text-caption font-semibold text-positive">추가됨</span>}
      </button>
    </li>
  );
}

/** 1회 투여량·1일 횟수·일수·용법. 숫자는 0보다 커야 하고 용법은 필수(CHECK, NOT NULL) */
export function DoseForm({ drug, onAdd }: { drug: Drug; onAdd: (item: DrugDraft) => void }) {
  const [dose, setDose] = useState("1");
  const [times, setTimes] = useState("3");
  const [days, setDays] = useState("3");
  const [instruction, setInstruction] = useState("식후 30분");
  const valid = Number(dose) > 0 && Number.isInteger(Number(times)) && Number(times) >= 1 && Number.isInteger(Number(days)) && Number(days) >= 1 && instruction.trim().length > 0;
  const input = "h-10 w-full rounded-lg border border-line/60 bg-white px-3 text-item outline-none focus:border-navy";

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-page p-3">
      <p className="text-body font-semibold">{drug.name}</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-caption text-ink-sub">
          1회 투여량 ({drug.unit})
          <input type="number" min={0.01} step={0.5} value={dose} onChange={(e) => setDose(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink-sub">
          1일 횟수
          <input type="number" min={1} step={1} value={times} onChange={(e) => setTimes(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink-sub">
          일수
          <input type="number" min={1} step={1} value={days} onChange={(e) => setDays(e.target.value)} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-caption text-ink-sub">
        용법
        <input value={instruction} maxLength={100} onChange={(e) => setInstruction(e.target.value)} className={input} />
      </label>
      <Button
        disabled={!valid}
        onClick={() =>
          onAdd({ drugCode: drug.drugCode, name: drug.name, unit: drug.unit, dose: Number(dose), timesPerDay: Number(times), durationDays: Number(days), instruction: instruction.trim() })
        }
      >
        처방에 추가
      </Button>
    </div>
  );
}
