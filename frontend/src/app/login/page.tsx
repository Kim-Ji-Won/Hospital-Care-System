"use client";

/**
 * P0 로그인·회원가입, P0a 회원가입
 * - 환자와 의료진이 같은 화면에서 역할만 바꿔 로그인 (1-1)
 * - 회원가입은 환자만. 환자 등록과 가입을 한 번에 하고 바로 예약으로 (1-4)
 */
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, NetworkError } from "@/lib/api/client";
import type { AccountType, Gender } from "@/lib/api/types";
import { homePathOf, useAuth } from "@/lib/auth";
import { Button, ErrorState, TextField, cx } from "@/components/ui";

type Mode = "login" | "signup";

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  // 이미 로그인했으면 역할별 첫 화면으로
  useEffect(() => {
    if (user) router.replace(homePathOf(user.role));
  }, [user, router]);

  return (
    <main className="mx-auto grid min-h-screen max-w-[1200px] grid-cols-[1fr_440px] items-center gap-16 px-6 py-12">
      <section>
        <h1 className="text-step font-bold text-navy">병원 예약·진료</h1>
        <p className="mt-3 text-item text-ink-sub">예약, 진료 기록, 검사 결과, 결제 내역을 한곳에서 확인합니다.</p>
        <div className="mt-8 rounded-xl border border-sky bg-white p-5">
          <p className="text-item font-semibold text-ink">처음 이용하시나요?</p>
          <p className="mt-1 text-body text-ink-sub">회원가입에서 환자 등록까지 한 번에 할 수 있어요. 가입하면 바로 예약할 수 있어요.</p>
        </div>
      </section>
      <section className="rounded-2xl border border-sky bg-white p-8">
        {mode === "login" ? <LoginForm onSignup={() => setMode("signup")} /> : <SignupForm onLogin={() => setMode("login")} />}
      </section>
    </main>
  );
}

function LoginForm({ onSignup }: { onSignup: () => void }) {
  const { login } = useAuth();
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("환자");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"failed" | "network" | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await login({ accountType, loginId, password });
      router.replace(homePathOf(user.role));
    } catch (err) {
      // 아이디는 남기고 비밀번호만 비움. 어느 쪽이 틀렸는지는 알려 주지 않음
      setPassword("");
      setError(err instanceof NetworkError ? "network" : "failed");
      if (!(err instanceof ApiError) && !(err instanceof NetworkError)) console.error(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div role="tablist" aria-label="로그인 역할" className="grid grid-cols-2 rounded-lg bg-page p-1">
        {(["환자", "의료진"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={accountType === t}
            onClick={() => setAccountType(t)}
            className={cx("rounded-md py-2 text-body font-semibold", accountType === t ? "bg-white text-navy shadow-sm" : "text-ink-sub")}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <ErrorState
          title="로그인하지 못했습니다"
          cause={
            error === "network"
              ? "서버와 연결되지 않았습니다. 잠시 뒤 다시 시도하세요."
              : `아이디 또는 비밀번호가 맞지 않습니다. 다시 입력하세요.${accountType === "환자" ? " 가입 전이라면 아이디를 먼저 만드세요." : ""}`
          }
        />
      )}

      <TextField label="아이디" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="아이디 입력" autoComplete="username" disabled={pending} />
      <TextField
        label="비밀번호"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호 입력"
        autoComplete="current-password"
        disabled={pending}
      />
      <Button type="submit" disabled={pending || !loginId || !password} className="h-12">
        {pending ? "로그인 중…" : "로그인"}
      </Button>

      {/* 의료진은 가입 버튼이 없음: 의료진 계정은 기준 정보(S8b)에서 등록 */}
      {accountType === "환자" && (
        <Button variant="ghost" onClick={onSignup}>
          회원가입
        </Button>
      )}
    </form>
  );
}

function SignupForm({ onLogin }: { onLogin: () => void }) {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", birthDate: "", gender: "" as Gender | "", phone: "", loginId: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [already, setAlready] = useState(false);
  const [pending, setPending] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const filled = form.name && form.birthDate && form.gender && form.phone && form.loginId && form.password;
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.gender) return;
    setPending(true);
    setFieldErrors({});
    setAlready(false);
    setNetworkError(false);
    try {
      await signup({ ...form, gender: form.gender });
      router.replace("/book");
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_REGISTERED") setAlready(true);
      else if (err instanceof ApiError && err.code === "LOGIN_ID_TAKEN") setFieldErrors({ loginId: "이미 쓰는 아이디입니다. 다른 아이디를 입력하세요." });
      else if (err instanceof ApiError && err.code === "VALIDATION_FAILED") setFieldErrors(err.fieldMap());
      else setNetworkError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <p className="text-title font-bold text-navy">회원가입</p>
        <p className="mt-1 text-body text-ink-sub">여기서 환자 등록과 가입을 한 번에 합니다.</p>
      </div>

      {already && (
        <ErrorState
          title="이미 가입된 환자일 수 있습니다"
          cause="이름, 생년월일, 연락처가 모두 같은 회원이 있습니다. 전에 가입했다면 로그인하세요. 아이디를 잊었다면 원무과 02-555-0142로 문의하세요."
          action={<Button variant="secondary" onClick={onLogin}>로그인하러 가기</Button>}
        />
      )}
      {networkError && <ErrorState title="가입하지 못했습니다" cause="서버와 연결되지 않았습니다. 입력한 내용은 그대로 있으니 잠시 뒤 다시 시도하세요." />}

      <div className="grid grid-cols-2 gap-3">
        <TextField label="이름" value={form.name} onChange={set("name")} error={fieldErrors.name} disabled={pending} />
        <TextField label="생년월일" type="date" value={form.birthDate} onChange={set("birthDate")} error={fieldErrors.birthDate} disabled={pending} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-caption font-semibold text-ink-sub">성별</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["남", "여"] as const).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={form.gender === g}
                onClick={() => setForm((f) => ({ ...f, gender: g }))}
                disabled={pending}
                className={cx("h-11 rounded-lg border text-item", form.gender === g ? "border-navy bg-select-bg font-semibold text-navy" : "border-line/60 bg-white text-ink")}
              >
                {g}
              </button>
            ))}
          </div>
          {fieldErrors.gender && <span className="text-caption text-error-ink">{fieldErrors.gender}</span>}
        </fieldset>
        <TextField label="연락처" value={form.phone} onChange={set("phone")} placeholder="010-0000-0000" error={fieldErrors.phone} disabled={pending} />
      </div>
      <TextField label="아이디 (20자 이내)" value={form.loginId} onChange={set("loginId")} maxLength={20} hint="영문, 숫자" error={fieldErrors.loginId} disabled={pending} />
      <TextField
        label="비밀번호"
        type="password"
        value={form.password}
        onChange={set("password")}
        hint="영문, 숫자 · 8자 이상"
        error={fieldErrors.password}
        autoComplete="new-password"
        disabled={pending}
      />
      <Button type="submit" disabled={pending || !filled} className="h-12">
        {pending ? "가입하는 중…" : "가입하고 예약하러 가기"}
      </Button>
      <Button variant="ghost" onClick={onLogin}>
        이미 아이디가 있어요
      </Button>
    </form>
  );
}
