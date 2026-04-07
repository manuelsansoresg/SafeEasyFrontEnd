import NotificationsPanel from "@/components/notifications/NotificationsPanel";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-6 text-sm text-gray-500">Cargando notificaciones...</div>}>
      <NotificationsPanel />
    </Suspense>
  );
}
