"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { chatService, ChatRequestError } from "@/services/chatService";
import { useAuthStore } from "@/store/useAuthStore";
import { useChat } from "@/context/ChatContext";
import { useChatStore } from "@/store/useChatStore";

interface DirectoryContactButtonProps {
  supplierId: number;
  supplierName?: string;
  supplierSlug?: string | null;
  supplierImage?: string | null;
  returnPath: string;
  className?: string;
}

export function DirectoryContactButton({
  supplierId,
  supplierName,
  supplierSlug,
  supplierImage,
  returnPath,
  className,
}: DirectoryContactButtonProps) {
  const router = useRouter();
  const { openChat } = useChat();
  const updateConversationList = useChatStore(
    (state) => state.updateConversationList,
  );
  const token = useAuthStore((state) => state.token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startChat = async () => {
    if (loading) return;
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const conversation = await chatService.createConversation({
        supplier_id: supplierId,
      });
      const directoryConversation = {
        ...conversation,
        my_role: "client" as const,
        supplier_name:
          conversation.supplier_name || supplierName || "Negocio",
        other_party_name:
          conversation.other_party_name || supplierName || "Negocio",
        supplier_slug:
          conversation.supplier_slug || supplierSlug || undefined,
        supplier_image:
          conversation.supplier_image || supplierImage || undefined,
        product_id: null,
        product_title: undefined,
        product_image: undefined,
        product_price: undefined,
        product_slug: undefined,
      };
      updateConversationList(directoryConversation);
      openChat(directoryConversation);
    } catch (requestError) {
      if (requestError instanceof ChatRequestError && requestError.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(returnPath)}`);
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo contactar al negocio.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        onClick={startChat}
        disabled={loading}
        className={
          className ||
          "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#168e00] px-8 py-4 text-base font-bold text-white shadow-[0_0_30px_-5px_rgba(22,142,0,0.55)] transition hover:-translate-y-1 hover:bg-[#137a00] disabled:cursor-wait disabled:opacity-70"
        }
      >
        {loading ? (
          <Loader2 className="animate-spin" size={19} />
        ) : (
          <MessageCircle size={19} />
        )}
        Contactar negocio
      </button>
      {error ? (
        <p className="mt-2 max-w-sm text-center text-xs font-semibold text-red-200 md:text-left">
          {error}
        </p>
      ) : null}
    </div>
  );
}
