"use client";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useMe, useSuperadminOverview, useSwitchAccount } from "@/lib/queries/auth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Td } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";

/** Superadmin only: every account (members, „Ava” = open it as admin without membership) and every user. */
export function SuperadminTab() {
  const me = useMe();
  const ov = useSuperadminOverview();
  const sw = useSwitchAccount();
  const toast = useToast();
  const router = useRouter();
  const open = async (id: string) => {
    try { await sw.mutateAsync(id); router.push("/app"); router.refresh(); } catch (e) { toast.error(errorMessage(e)); }
  };
  if (ov.isLoading) return <Card><div className="p-6"><Loading /></div></Card>;
  if (ov.error || !ov.data) return <Card><div className="p-6"><ErrorState error={ov.error} onRetry={() => ov.refetch()} /></div></Card>;
  const { accounts, users } = ov.data;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader title={t("settings.superadmin.accounts")}><p className="text-[13px] text-faint">{t("settings.superadmin.accountsSub")}</p></CardHeader>
        {accounts.length === 0 ? <EmptyState title={t("settings.superadmin.empty")} /> : (
          <Table>
            <thead><tr><th>{t("settings.superadmin.account")}</th><th>{t("settings.superadmin.members")}</th><th>{t("settings.superadmin.created")}</th><th /></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <Td l={t("settings.superadmin.account")}><span className="font-semibold">{a.name}</span></Td>
                  <Td l={t("settings.superadmin.members")}>
                    {a.members.length === 0 ? <span className="text-faint">{t("settings.superadmin.noMembers")}</span> : (
                      <ul className="m-0 p-0 list-none grid gap-0.5">
                        {a.members.map((m) => (
                          <li key={m.user_id}>{m.email} <span className="text-faint text-[12px]">· {tEnum("settings.members.roles", m.role)}{m.status === "invited" ? ` · ${t("settings.members.invited")}` : ""}</span></li>
                        ))}
                      </ul>
                    )}
                  </Td>
                  <Td l={t("settings.superadmin.created")}>{fmtDate(a.created_at)}</Td>
                  <Td l="">
                    {a.id === me.data?.account.id ? <Pill tone="success">{t("settings.superadmin.current")}</Pill>
                      : <Button size="sm" busy={sw.isPending && sw.variables === a.id} onClick={() => open(a.id)}>{t("settings.superadmin.open")}</Button>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card>
        <CardHeader title={t("settings.superadmin.users")}><p className="text-[13px] text-faint">{t("settings.superadmin.usersSub")}</p></CardHeader>
        <Table>
          <thead><tr><th>{t("settings.superadmin.name")}</th><th>{t("settings.superadmin.email")}</th><th>{t("settings.superadmin.accountsCount")}</th><th>{t("settings.superadmin.lastLogin")}</th><th>{t("settings.superadmin.created")}</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <Td l={t("settings.superadmin.name")}><span className="font-semibold">{u.name || "—"}</span>{!u.is_active && <> <Pill tone="error">{t("settings.superadmin.inactive")}</Pill></>}</Td>
                <Td l={t("settings.superadmin.email")}>{u.email}</Td>
                <Td l={t("settings.superadmin.accountsCount")}>{u.accounts}</Td>
                <Td l={t("settings.superadmin.lastLogin")}>{fmtDateTime(u.last_login_at)}</Td>
                <Td l={t("settings.superadmin.created")}>{fmtDate(u.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
