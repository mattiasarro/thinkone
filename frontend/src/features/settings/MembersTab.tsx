"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t, tEnum } from "@/i18n";
import { useInvite, useMembers, useUpdateMember, useMe } from "@/lib/queries/auth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Table, Td } from "@/components/ui/Table";
import { Pill, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconPlus } from "@/components/ui/Icons";

const ROLES = ["admin", "operator", "viewer"];
const schema = z.object({ email: z.string().email(t("common.validationError")), role: z.string().min(1) });
type Form = z.infer<typeof schema>;

export function MembersTab() {
  const list = useMembers();
  const me = useMe();
  const invite = useInvite();
  const update = useUpdateMember();
  const toast = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { role: "operator" } });
  const onInvite = handleSubmit(async (v) => { try { await invite.mutateAsync(v); toast.success(t("settings.members.invited_")); reset({ email: "", role: "operator" }); } catch (e) { toast.error(errorMessage(e)); } });
  const onRole = async (id: string, role: string) => { try { await update.mutateAsync({ id, role }); toast.success(t("settings.members.roleChanged")); } catch (e) { toast.error(errorMessage(e)); } };
  const isAdmin = me.data?.account.role === "admin";
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader title={t("settings.members.invite")} />
        <form onSubmit={onInvite} noValidate className="card-b grid gap-x-3 sm:grid-cols-[1fr_180px_auto] items-start">
          <Input label={t("settings.members.email")} type="email" required error={errors.email?.message} {...register("email")} />
          <Select label={t("settings.members.role")} {...register("role")} options={ROLES.map((r) => ({ value: r, label: tEnum("settings.members.roles", r) }))} />
          <div className="field sm:pt-6"><Button type="submit" variant="primary" busy={invite.isPending}><IconPlus width={16} height={16} />{t("settings.members.invite")}</Button></div>
        </form>
      </Card>
      <Card>
        {list.isLoading ? <div className="p-6"><Loading /></div> : list.error ? <div className="p-6"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div> : (list.data ?? []).length === 0 ? <EmptyState title={t("settings.members.empty")} /> : (
          <Table>
            <thead><tr><th>{t("settings.members.name")}</th><th>{t("settings.members.email")}</th><th>{t("settings.members.status")}</th><th>{t("settings.members.role")}</th></tr></thead>
            <tbody>
              {(list.data ?? []).map((m) => (
                <tr key={m.id}>
                  <Td l={t("settings.members.name")}><span className="font-semibold">{m.name || "—"}</span></Td>
                  <Td l={t("settings.members.email")}>{m.email}</Td>
                  <Td l={t("settings.members.status")}><Pill tone={statusTone(m.status)}>{m.status === "active" ? t("settings.members.active") : t("settings.members.invited")}</Pill></Td>
                  <Td l={t("settings.members.role")}>
                    <select className="fld fld-sm w-auto" value={m.role} aria-label={t("settings.members.role")} disabled={!isAdmin || m.user_id === me.data?.user_id} onChange={(e) => onRole(m.id, e.target.value)}>
                      {ROLES.map((r) => <option key={r} value={r}>{tEnum("settings.members.roles", r)}</option>)}
                      {!ROLES.includes(m.role) && <option value={m.role}>{m.role}</option>}
                    </select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
