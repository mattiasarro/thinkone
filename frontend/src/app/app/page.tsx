import type { Metadata } from "next";
import { HomePage } from "@/features/home/HomePage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("nav.avaleht") };
export default function Page() { return <HomePage />; }
