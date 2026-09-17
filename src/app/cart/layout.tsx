import { ClientShell } from "@/components/client/ClientShell";
import PendingCartCheckoutGuard from "@/components/cart/PendingCartCheckoutGuard";

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientShell>
      <PendingCartCheckoutGuard />
      {children}
    </ClientShell>
  );
}
