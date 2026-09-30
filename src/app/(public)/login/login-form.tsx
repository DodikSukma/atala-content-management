"use client";

import { useActionState, useEffect, useState, type KeyboardEvent } from "react";
import { CircleAlert, Eye, EyeOff, LogIn } from "lucide-react";
import { Button, Field, IconButton, Input } from "@/components/ui";
import { loginAction } from "@/lib/auth/actions";

type LoginFormProps = {
  next: string;
  disabled?: boolean;
};

export function LoginForm({ next, disabled = false }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const error = state?.error;

  // Setelah gagal, arahkan fokus ke isian yang paling mungkin perlu diperbaiki.
  useEffect(() => {
    if (!error) return;
    const usernameInput = document.getElementById("login-username") as HTMLInputElement | null;
    const passwordInput = document.getElementById("login-password") as HTMLInputElement | null;
    if (!usernameInput?.value) usernameInput?.focus();
    else passwordInput?.select();
  }, [error, attempt]);

  function handleCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  }

  const passwordHintId = "login-password-hint";
  const errorId = "login-error";

  return (
    <form
      action={formAction}
      onSubmit={() => setAttempt((value) => value + 1)}
      noValidate
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="next" value={next} />

      {error ? (
        <div
          key={attempt}
          id={errorId}
          role="alert"
          className="flex items-start gap-2.5 rounded-control border border-red-200 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger animate-fade-in"
        >
          <CircleAlert size={18} className="mt-px shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <Field label="Nama pengguna" htmlFor="login-username">
        <Input
          id="login-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          maxLength={128}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={disabled}
          className="h-11"
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-[13px] font-semibold text-ink">
          Kata sandi
        </label>
        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyUp={handleCapsLock}
            onKeyDown={handleCapsLock}
            onBlur={() => setCapsLock(false)}
            aria-describedby={capsLock ? passwordHintId : undefined}
            disabled={disabled}
            className="h-11 pr-12"
          />
          <IconButton
            type="button"
            size="sm"
            icon={showPassword ? EyeOff : Eye}
            label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            aria-pressed={showPassword}
            aria-controls="login-password"
            onClick={() => setShowPassword((value) => !value)}
            disabled={disabled}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 active:-translate-y-1/2"
          />
        </div>
        {capsLock ? (
          <p id={passwordHintId} className="text-xs font-medium text-warning" aria-live="polite">
            Caps Lock sedang aktif.
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        icon={LogIn}
        loading={pending}
        disabled={disabled}
        className="mt-1 w-full"
      >
        {pending ? "Memeriksa..." : "Masuk"}
      </Button>
    </form>
  );
}
