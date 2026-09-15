import type { Metadata } from "next";
import { ObjectWizard } from "@/features/assets/ObjectWizard";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("assets.newTitle") };
export default function Page() { return <ObjectWizard step={1} />; }
