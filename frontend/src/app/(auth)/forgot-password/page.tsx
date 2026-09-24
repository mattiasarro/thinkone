import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.forgotTitle") };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
