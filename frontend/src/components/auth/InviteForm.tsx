"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t } from "@/i18n";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useAcceptInvite } from "@/lib/queries/auth";
import { errorMessage, isApiError } from "@/lib/api";

const schema = z.object({ name: z.string().min(1, t("common.required")), password: z.string().min(8, t("auth.passwordHint")) });
type Form = z.infer<typeof schema>;

export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const accept = useAcceptInvite();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async (v) => {
    try { await accept.mutateAsync({ token, ...v }); router.replace("/app"); } catch { /* shown */ }
  });
  const err = accept.error ? (isApiError(accept.error) && (accept.error.status === 404 || accept.error.status === 400) ? t("auth.inviteInvalid") : errorMessage(accept.error)) : null;
  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-xl mb-1">{t("auth.inviteTitle")}</h1>
      <p className="text-muted text-sm mb-6">{t("auth.inviteSub")}</p>
      <Input label={t("auth.name")} autoComplete="name" autoFocus error={errors.name?.message} {...register("name")} />
      <Input label={t("auth.password")} type="password" autoComplete="new-password" hint={t("auth.passwordHint")} error={errors.password?.message} {...register("password")} />
      {err && <div className="note error mb-4" role="alert">{err}</div>}
      <Button type="submit" variant="primary" className="w-full" busy={accept.isPending}>{t("auth.acceptInvite")}</Button>
    </form>
  );
}
