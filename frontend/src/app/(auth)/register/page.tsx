import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.register") };

export default function RegisterPage() {
  return <RegisterForm />;
}
