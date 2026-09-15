"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t } from "@/i18n";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useRegister } from "@/lib/queries/auth";
import { errorMessage } from "@/lib/api";

const schema = z.object({
  account_name: z.string().min(1, t("common.required")),
  name: z.string().min(1, t("common.required")),
  email: z.string().email(t("common.validationError")),
  password: z.string().min(8, t("auth.passwordHint")),
});
type Form = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const reg = useRegister();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    try { await reg.mutateAsync(v); router.replace("/app"); } catch { /* shown */ }
  });
  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-xl mb-1">{t("auth.registerTitle")}</h1>
      <p className="text-muted text-sm mb-6">{t("auth.registerSub")}</p>
      <Input label={t("auth.accountName")} autoFocus error={errors.account_name?.message} {...register("account_name")} />
      <Input label={t("auth.name")} autoComplete="name" error={errors.name?.message} {...register("name")} />
      <Input label={t("auth.email")} type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <Input label={t("auth.password")} type="password" autoComplete="new-password" hint={t("auth.passwordHint")} error={errors.password?.message} {...register("password")} />
      {reg.error && <div className="note error mb-4" role="alert">{errorMessage(reg.error)}</div>}
      <Button type="submit" variant="primary" className="w-full" busy={reg.isPending}>{t("auth.register")}</Button>
      <p className="text-center text-sm text-muted mt-5">{t("auth.hasAccount")} <Link href="/login" className="text-primary font-semibold">{t("auth.login")}</Link></p>
    </form>
  );
}
