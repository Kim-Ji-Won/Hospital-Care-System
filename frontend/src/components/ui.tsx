/**
 * 공통 UI 부품. 디자인 기준(Figma) 규칙:
 * - 주색은 네이비, 주황은 오류 아이콘·테두리에만
 * - 상태 칩: 진행 중 파랑, 끝남 녹색, 없던 일(취소·노쇼) 회색, 주의(이상) 주황. 색만으로 구분하지 않고 글자를 함께 씀
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

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

export { cx };
