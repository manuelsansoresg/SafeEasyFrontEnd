"use client";

import { Suspense } from "react";
import { MessagesContent } from "@/components/chat/MessagesContent";

export default function ClientMessagesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando mensajes...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
