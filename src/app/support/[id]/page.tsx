"use client";

import { SupportChatShell } from "@/components/support-chat/SupportChatShell";

export default function SupportConversationPage() {
  return (
    <div className="bg-[#f2f3f4] px-4 pb-20 pt-24 md:px-8 md:pb-24 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <SupportChatShell mode="user" />
      </div>
    </div>
  );
}
