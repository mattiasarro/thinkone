"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t } from "@/i18n";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useLogin } from "@/lib/queries/auth";
import { errorMessage, isApiError } from "@/lib/api";

const schema = z.object({ email: z.string().email(t("common.validationError")), password: z.string().min(1, t("common.required")) });
type Form = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    try {
      await login.mutateAsync(v);
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/app");
    } catch { /* shown below */ }
  });
  const err = login.error ? (isApiError(login.error) && login.error.status === 401 ? t("auth.invalidCredentials") : errorMessage(login.error)) : null;
  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-xl mb-1">{t("auth.loginTitle")}</h1>
      <p className="text-muted text-sm mb-6">{t("auth.loginSub")}</p>
      {params.get("reset") === "1" && !err && <div className="note success mb-4" role="status">{t("auth.passwordChanged")}</div>}
      <Input label={t("auth.email")} type="email" autoComplete="email" autoFocus error={errors.email?.message} {...register("email")} />
      <Input label={t("auth.password")} type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
      <p className="text-right text-sm -mt-2 mb-4"><Link href="/forgot-password" className="text-primary font-semibold">{t("auth.forgotPassword")}</Link></p>
      {err && <div className="note error mb-4" role="alert">{err}</div>}
      <Button type="submit" variant="primary" className="w-full" busy={login.isPending}>{t("auth.login")}</Button>
      <p className="text-center text-sm text-muted mt-5">{t("auth.noAccount")} <Link href="/register" className="text-primary font-semibold">{t("auth.register")}</Link></p>
    </form>
  );
}
