"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t } from "@/i18n";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useResetPassword } from "@/lib/queries/auth";
import { errorMessage, isApiError } from "@/lib/api";

const schema = z.object({ password: z.string().min(8, t("auth.passwordHint")) });
type Form = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const reset = useResetPassword();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    try { await reset.mutateAsync({ token, ...v }); router.replace("/login?reset=1"); } catch { /* shown below */ }
  });
  const invalid = isApiError(reset.error) && reset.error.status === 404;
  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-xl mb-1">{t("auth.resetTitle")}</h1>
      <p className="text-muted text-sm mb-6">{t("auth.resetSub")}</p>
      <Input label={t("auth.newPassword")} type="password" autoComplete="new-password" autoFocus hint={t("auth.passwordHint")} error={errors.password?.message} {...register("password")} />
      {invalid ? (
        <div className="note error mb-4" role="alert">
          <span>{t("auth.resetInvalid")} <Link href="/forgot-password" className="font-semibold underline">{t("auth.requestNewLink")}</Link></span>
        </div>
      ) : reset.error ? (
        <div className="note error mb-4" role="alert">{errorMessage(reset.error)}</div>
      ) : null}
      <Button type="submit" variant="primary" className="w-full" busy={reset.isPending}>{t("auth.setPassword")}</Button>
    </form>
  );
}
