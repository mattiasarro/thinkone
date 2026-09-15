import { LogoMark } from "@/components/ui/Icons";
import { t } from "@/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <LogoMark width={36} height={36} className="text-ink" />
          <div>
            <div className="font-heading font-semibold text-xl leading-6 tracking-tight">{t("app.name")}</div>
            <div className="text-muted text-xs">{t("app.tagline")}</div>
          </div>
        </div>
        <div className="card pad">{children}</div>
      </div>
    </main>
  );
}
