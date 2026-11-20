"use client";

/**
 * 기준 정보(S8) 한 탭의 표 + 오른쪽 추가·수정 패널. 탭마다 열·입력칸·API만 설정으로 넘깁니다.
 * 코드(PK)는 만든 뒤 잠그고(lockedOnEdit), 참조 중이라 지울 수 없으면 서버가 돌려준 사용 건수를 보여 줍니다.
 */
import { useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { josa } from "@/lib/josa";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Skeleton, TextField, cx, selectableRow } from "@/components/ui";

export type FormValues = Record<string, string>;

export interface FieldDef {
  key: string;
  label: string;
  kind?: "text" | "number" | "password" | "choice";
  options?: string[];
  /** 선택지 표시 이름 (값은 코드) */
  optionLabel?: (value: string) => string;
  optional?: boolean;
  /** 만든 뒤에는 고칠 수 없음(PK, FK 등) */
  lockedOnEdit?: boolean;
  /** 추가할 때만 보이는 칸(비밀번호 등) */
  createOnly?: boolean;
  hint?: string;
  placeholder?: string;
  /** 다른 칸 값에 따라 숨김 (예: 원무는 진료과 없음) */
  hidden?: (form: FormValues) => boolean;
}

export interface MasterConfig<T> {
  /** "약품" — 패널 제목과 버튼에 씀 */
  noun: string;
  searchLabel?: string;
  queryKey: (q: string) => QueryKey;
  /** 저장 뒤 다시 불러올 키 묶음 */
  invalidate: QueryKey;
  list: (q: string) => Promise<T[]>;
  idOf: (row: T) => string | number;
  columns: { label: string; className?: string; render: (row: T) => ReactNode }[];
  fields: FieldDef[];
  toForm: (row: T) => FormValues;
  create: (body: Record<string, unknown>) => Promise<unknown>;
  update: (row: T, changes: Record<string, unknown>) => Promise<unknown>;
  remove?: (row: T) => Promise<unknown>;
  /** 지울 수 없는 이유(목록에서 이미 알 때). null이면 삭제 버튼을 보여 줌 */
  removeBlocked?: (row: T) => string | null;
  /** 수정할 때 알려 둘 말 (예: 단가는 다음 청구부터) */
  editNote?: string;
  emptyText?: string;
}

/** 입력칸 문자열 → API 값: 숫자 칸은 숫자, 빈 선택 칸은 null */
function toValue(f: FieldDef, raw: string) {
  if (f.kind === "number") return raw.trim() === "" ? null : Number(raw);
  if (f.optional && raw.trim() === "") return null;
  return raw.trim();
}

function errorText(e: unknown, noun: string): string {
  if (!(e instanceof ApiError)) return "서버와 연결되지 않았습니다. 입력한 내용은 그대로 있으니 잠시 뒤 다시 시도하세요.";
  const d = (e.details ?? {}) as Record<string, unknown>;
  switch (e.code) {
    case "CODE_TAKEN":
      return `같은 코드의 ${josa(noun, "이/가")} 이미 있습니다.`;
    case "IN_USE":
      return `${d.count}건에서 쓰고 있어 지울 수 없습니다. 기록은 지우지 않고 보관합니다.`;
    case "LOGIN_ID_TAKEN":
      return `${d.name} 님이 쓰는 아이디입니다. 다른 아이디를 정하세요.`;
    case "BED_COUNT_TOO_LOW":
      return `입원 중인 ${d.occupiedBeds}명보다 적게 줄일 수 없습니다.`;
    case "VALIDATION_FAILED":
      return "입력한 값을 확인하세요.";
    default:
      return "저장하지 못했습니다. 잠시 뒤 다시 시도하세요.";
  }
}

export function MasterTable<T>({ config, addRequested, onAddHandled }: { config: MasterConfig<T>; addRequested: boolean; onAddHandled: () => void }) {
  const [input, setInput] = useState("");
  const q = input.trim();
  const list = useQuery({ queryKey: config.queryKey(q), queryFn: () => config.list(q), placeholderData: keepPreviousData });
  const [selected, setSelected] = useState<string | number | null>(null);
  const row = list.data?.find((r) => config.idOf(r) === selected) ?? null;
  const mode: "add" | "edit" | null = addRequested ? "add" : row ? "edit" : null;

  return (
    <div className="grid grid-cols-[1fr_340px] gap-6">
      <div className="flex flex-col gap-3">
        {config.searchLabel && (
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-ink-sub">{config.searchLabel}</span>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="검색" className="h-11 rounded-lg border border-line/60 bg-white px-3 text-item outline-none focus:border-navy" />
          </label>
        )}
        {list.isPending ? (
          <Skeleton rows={5} />
        ) : list.isError ? (
          <ErrorState title={`${config.noun} 목록을 불러오지 못했습니다`} cause="잠시 뒤 다시 시도하세요." />
        ) : list.data.length === 0 ? (
          <EmptyState title={q ? `${josa(`'${q}'`, "으로/로")} 찾은 ${josa(config.noun, "이/가")} 없습니다` : `등록된 ${josa(config.noun, "이/가")} 없습니다`} description={config.emptyText} />
        ) : (
          <table className="w-full table-fixed text-left text-body break-keep">
            <thead className="border-b border-sky text-caption text-ink-sub">
              <tr>
                {config.columns.map((c) => (
                  <th key={c.label} className={cx("px-2 py-2.5 font-semibold", c.className)}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => {
                const id = config.idOf(r);
                return (
                  <tr
                    key={String(id)}
                    {...selectableRow(id === selected && !addRequested, () => {
                      onAddHandled();
                      setSelected(id);
                    })}
                  >
                    {config.columns.map((c, i) => (
                      <td key={c.label} className={cx("px-2 py-2.5", i === 0 && "font-bold text-ink", c.className)}>
                        {c.render(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="self-start">
        {mode ? (
          <EditPanel
            key={mode === "add" ? "add" : String(selected)}
            config={config}
            row={mode === "edit" ? row : null}
            onDone={(id) => {
              onAddHandled();
              setSelected(id);
            }}
            onClose={() => {
              onAddHandled();
              setSelected(null);
            }}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-sky bg-white p-6 text-center text-body text-ink-sub">행을 고르면 여기서 고칠 수 있습니다.</div>
        )}
      </div>
    </div>
  );
}

function EditPanel<T>({ config, row, onDone, onClose }: { config: MasterConfig<T>; row: T | null; onDone: (id: string | number | null) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editing = !!row;
  const initial = row ? config.toForm(row) : Object.fromEntries(config.fields.map((f) => [f.key, f.kind === "choice" ? (f.options?.[0] ?? "") : ""]));
  const [form, setForm] = useState<FormValues>(initial);
  const [confirming, setConfirming] = useState(false);
  const visible = config.fields.filter((f) => !(f.hidden?.(form) ?? false) && !(editing && f.createOnly));

  const save = useMutation({
    mutationFn: () => {
      if (!row) return config.create(Object.fromEntries(visible.map((f) => [f.key, toValue(f, form[f.key] ?? "")])));
      const changes = Object.fromEntries(visible.filter((f) => !f.lockedOnEdit && form[f.key] !== initial[f.key]).map((f) => [f.key, toValue(f, form[f.key] ?? "")]));
      return config.update(row, changes);
    },
    // 추가한 뒤에는 새 행을 골라 두어 저장된 것을 바로 보여 줌
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: config.invalidate });
      onDone(row ? config.idOf(row) : saved ? config.idOf(saved as T) : null);
    },
  });
  const remove = useMutation({
    mutationFn: () => config.remove!(row!),
    onSuccess: () => {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: config.invalidate });
      onClose();
    },
  });

  const fieldErrors = save.error instanceof ApiError && save.error.code === "VALIDATION_FAILED" ? save.error.fieldMap() : {};
  const missing = visible.some((f) => !f.optional && !(editing && f.lockedOnEdit) && !(form[f.key] ?? "").trim());
  const changed = !editing || visible.some((f) => !f.lockedOnEdit && form[f.key] !== initial[f.key]);
  const blocked = row && config.removeBlocked ? config.removeBlocked(row) : null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-body font-bold text-ink-sub">{editing ? `${config.noun} 수정` : `${config.noun} 추가`}</p>
        <Button variant="ghost" className="h-8 px-2" onClick={onClose}>
          닫기
        </Button>
      </div>
      {visible.map((f) =>
        f.kind === "choice" ? (
          <div key={f.key} className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-ink-sub">{f.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {f.options!.map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={editing && f.lockedOnEdit}
                  aria-pressed={form[f.key] === o}
                  onClick={() => setForm((v) => ({ ...v, [f.key]: o }))}
                  className={cx(
                    "h-9 rounded-full border px-3.5 text-body",
                    form[f.key] === o ? "border-navy bg-navy font-bold text-white" : "border-line bg-white text-ink hover:bg-select-bg",
                    editing && f.lockedOnEdit && "cursor-not-allowed opacity-60",
                  )}
                >
                  {f.optionLabel?.(o) ?? o}
                </button>
              ))}
            </div>
            {fieldErrors[f.key] && <span className="text-caption text-error-ink">{fieldErrors[f.key]}</span>}
          </div>
        ) : (
          <TextField
            key={f.key}
            label={`${f.label}${f.optional ? " (선택)" : ""}`}
            type={f.kind === "password" ? "password" : f.kind === "number" ? "number" : "text"}
            inputMode={f.kind === "number" ? "numeric" : undefined}
            autoComplete={f.kind === "password" ? "new-password" : "off"}
            value={form[f.key] ?? ""}
            placeholder={f.placeholder}
            disabled={editing && f.lockedOnEdit}
            hint={editing && f.lockedOnEdit ? "만든 뒤에는 고칠 수 없습니다." : f.hint}
            error={fieldErrors[f.key]}
            onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        ),
      )}
      {editing && config.editNote && <p className="text-caption text-ink-sub">{config.editNote}</p>}
      {save.isError && <p className="text-body text-error-ink">{errorText(save.error, config.noun)}</p>}
      <Button className="h-11" disabled={missing || !changed || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "저장하는 중…" : editing ? "수정 저장" : `${config.noun} 추가`}
      </Button>
      {editing && config.remove && (blocked ? <p className="text-caption text-ink-sub">{blocked}</p> : (
        <Button variant="ghost" className="self-start" onClick={() => setConfirming(true)}>
          {config.noun} 삭제
        </Button>
      ))}
      <ConfirmDialog
        open={confirming}
        title={`이 ${josa(config.noun, "을/를")} 지울까요?`}
        confirmLabel="삭제"
        pending={remove.isPending}
        confirmDisabled={remove.error instanceof ApiError && remove.error.code === "IN_USE"}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          setConfirming(false);
          remove.reset();
        }}
      >
        <p>지우면 되돌릴 수 없습니다. 기록에 쓰인 적이 있으면 서버가 막습니다.</p>
        {remove.isError && <p className="mt-2 text-error-ink">{errorText(remove.error, config.noun)}</p>}
      </ConfirmDialog>
    </Card>
  );
}
