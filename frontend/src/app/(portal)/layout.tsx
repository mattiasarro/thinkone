import "@/features/portal/portal.css";
import { PortalHeader } from "@/features/portal/PortalHeader";

/** The tenant's deal room: no operator shell, no sidebar — just the centered ThinkOne mark and the landlord's name. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal min-h-screen">
      <PortalHeader />
      <main className="portal-main">{children}</main>
    </div>
  );
}
