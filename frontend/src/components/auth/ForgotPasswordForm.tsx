"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t } from "@/i18n";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useForgotPassword } from "@/lib/queries/auth";
import { errorMessage } from "@/lib/api";

const schema = z.object({ email: z.string().email(t("common.validationError")) });
type Form = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const forgot = useForgotPassword();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    try { await forgot.mutateAsync(v); } catch { /* shown below */ }
  });
  const back = <p className="text-center text-sm text-muted mt-5"><Link href="/login" className="text-primary font-semibold">{t("auth.backToLogin")}</Link></p>;
  if (forgot.isSuccess) {
    return (
      <div>
        <h1 className="text-xl mb-4">{t("auth.forgotTitle")}</h1>
        <div className="note success" role="status">{t("auth.resetSent")}</div>
        {back}
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-xl mb-1">{t("auth.forgotTitle")}</h1>
      <p className="text-muted text-sm mb-6">{t("auth.forgotSub")}</p>
      <Input label={t("auth.email")} type="email" autoComplete="email" autoFocus error={errors.email?.message} {...register("email")} />
      {forgot.error && <div className="note error mb-4" role="alert">{errorMessage(forgot.error)}</div>}
      <Button type="submit" variant="primary" className="w-full" busy={forgot.isPending}>{t("auth.sendResetLink")}</Button>
      {back}
    </form>
  );
}
