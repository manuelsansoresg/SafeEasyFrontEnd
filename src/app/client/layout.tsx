import { ClientShell } from "@/components/client/ClientShell";
import PendingPaymentReservationBanner from "@/components/orders/PendingPaymentReservationBanner";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientShell>
      <PendingPaymentReservationBanner />
      {children}
    </ClientShell>
  );
}
