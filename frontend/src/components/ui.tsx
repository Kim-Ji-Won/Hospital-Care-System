"use client";

/**
 * 공통 UI 부품. 디자인 기준(Figma) 규칙:
 * - 주색은 네이비, 주황은 오류 아이콘·테두리에만
 * - 상태 칩: 진행 중 파랑, 끝남 녹색, 없던 일(취소·노쇼) 회색, 주의(이상) 주황. 색만으로 구분하지 않고 글자를 함께 씀
 */
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ---------- 버튼 ----------

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-body font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" && "bg-navy text-white hover:bg-navy/90",
        variant === "secondary" && "border border-line bg-white text-navy hover:bg-select-bg",
        variant === "ghost" && "text-navy hover:bg-select-bg",
        className,
      )}
    />
  );
}

// ---------- 상태 칩 ----------

type ChipTone = "progress" | "done" | "void" | "alert";

const TONE_BY_STATUS: Record<string, ChipTone> = {
  예약: "progress",
  요청: "progress",
  시행: "progress",
  미결제: "progress",
  "입원 중": "progress",
  완료: "done",
  정상: "done",
  퇴원: "done",
  취소: "void",
  노쇼: "void",
  이상: "alert",
};

export function Chip({ children, tone }: { children: string; tone?: ChipTone }) {
  const t = tone ?? TONE_BY_STATUS[children] ?? "progress";
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-full px-2.5 text-caption font-semibold whitespace-nowrap",
        t === "progress" && "bg-select-bg text-navy",
        t === "done" && "bg-positive-bg text-positive",
        t === "void" && "bg-neutral-bg text-ink-sub",
        t === "alert" && "border border-warn bg-warn-bg text-error-ink",
      )}
    >
      {children}
    </span>
  );
}

// ---------- 카드·제목 ----------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-xl border border-sky bg-white p-5", className)}>{children}</section>;
}

export function PageHeader({ title, actions, sub }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-title font-bold text-navy">{title}</h1>
        {sub && <p className="mt-1 text-body text-ink-sub">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

// ---------- 입력칸 ----------

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-caption font-semibold text-ink-sub">{label}</span>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        className={cx(
          "h-11 rounded-lg border bg-white px-3 text-item text-ink outline-none placeholder:text-ink-sub/60",
          "focus:border-navy disabled:bg-neutral-bg",
          error ? "border-warn" : "border-line/60",
        )}
      />
      {error ? (
        <span className="text-caption text-error-ink">{error}</span>
      ) : (
        hint && <span className="text-caption text-ink-sub">{hint}</span>
      )}
    </label>
  );
}

// ---------- 네 가지 상태: 로딩·비어 있음·오류 ----------

/** 로딩: 기본 화면과 같은 뼈대. 줄 수만 받습니다. */
export function Skeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-3", className)} aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-skeleton" />
      ))}
    </div>
  );
}

/** 비어 있음: 왜 비었는지 한 줄, 다음에 할 일 버튼 하나 (권한상 못 하는 일이면 버튼 없음) */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-sky bg-white px-6 py-12 text-center">
      <p className="text-item font-semibold text-ink">{title}</p>
      {description && <p className="max-w-md text-body text-ink-sub">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** 오류: 무엇이 안 됐는지, 원인, 다음 행동 순서. 이미 받은 데이터와 입력값은 지우지 않음 */
export function ErrorState({ title, cause, action }: { title: string; cause?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-warn bg-warn-bg px-5 py-4">
      <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-warn text-caption font-bold text-white">
        !
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-item font-semibold text-error-ink">{title}</p>
        {cause && <p className="text-body text-error-ink">{cause}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

// ---------- 확인 대화상자 ----------

/**
 * 되돌릴 수 없는 일(노쇼, 검사 완료, 결제 취소 등)에만 씁니다(S9).
 * 위험 색을 쓰지 않고, 취소 쪽 버튼을 왼쪽에 둡니다.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "닫기",
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // 네이티브 <dialog>의 showModal: 포커스가 안으로 들어가고 Tab이 밖으로 나가지 않으며, 닫으면 원래 자리로 돌아감
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      // Esc: 처리 중이 아니면 닫기
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
      // 바깥(배경)을 누르면 닫기. 대화상자 안쪽 클릭은 target이 안쪽 요소라 해당 없음
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      className="m-auto w-full max-w-md rounded-2xl bg-white p-0 shadow-xl backdrop:bg-ink/30"
    >
      {open && (
        <div className="p-6">
          <h2 className="text-title font-bold text-navy">{title}</h2>
          {children && <div className="mt-3 text-body text-ink">{children}</div>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={pending} autoFocus>
              {cancelLabel}
            </Button>
            <Button onClick={onConfirm} disabled={pending}>
              {pending ? "처리하는 중…" : confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

// ---------- 고를 수 있는 표 행 ----------

/**
 * 표 행을 눌러 오른쪽 패널에 여는 화면(S1, S3, S4, S5a, S5b, S6, S8)이 함께 씁니다.
 * 마우스뿐 아니라 Tab으로 행에 가서 Enter·Space로 고를 수 있게 합니다.
 */
export function selectableRow(selected: boolean, onSelect: () => void, className?: string) {
  return {
    tabIndex: 0,
    "aria-selected": selected,
    onClick: onSelect,
    onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
    className: cx(
      "cursor-pointer border-b border-skeleton outline-none hover:bg-page focus-visible:bg-select-bg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy",
      selected && "bg-select-bg hover:bg-select-bg",
      className,
    ),
  };
}

// ---------- 탭 ----------

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div
      role="tablist"
      className="flex gap-1 border-b border-sky"
      // 탭 사이는 ←·→로 움직임 (Tab 키로는 선택된 탭 하나에만 머묾)
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const i = items.findIndex((t) => t.value === value);
        const next = items[(i + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length];
        onChange(next.value);
        (e.currentTarget.querySelector(`[data-tab="${next.value}"]`) as HTMLElement | null)?.focus();
      }}
    >
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          data-tab={t.value}
          tabIndex={value === t.value ? 0 : -1}
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            "-mb-px border-b-2 px-4 py-2.5 text-body font-semibold",
            value === t.value ? "border-navy text-navy" : "border-transparent text-ink-sub hover:text-navy",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export { cx };
