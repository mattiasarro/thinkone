import type { Metadata } from "next";
import { t } from "@/i18n";
import { PageHead } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/State";
import { IconChat } from "@/components/ui/Icons";

export const metadata: Metadata = { title: t("nav.suhtlus") };
export default function Page() {
  return (
    <div>
      <PageHead title={t("suhtlus.title")} sub={t("suhtlus.sub")} />
      <div className="card">
        <EmptyState icon={<IconChat width={40} height={40} />} title={t("suhtlus.placeholder")} sub={t("suhtlus.placeholderSub")} />
      </div>
    </div>
  );
}
