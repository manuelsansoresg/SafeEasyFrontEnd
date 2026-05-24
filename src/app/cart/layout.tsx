import { ClientShell } from "@/components/client/ClientShell";

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientShell>{children}</ClientShell>;
}
