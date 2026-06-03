"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Conversation } from '@/types/chat';

export interface OpenChat extends Conversation {
  isMinimized?: boolean;
}

interface ChatContextType {
  openChats: OpenChat[];
  openChat: (conversation: Conversation) => void;
  closeChat: (conversationId: string | number) => void;
  minimizeChat: (conversationId: string | number) => void;
  toggleChat: (conversationId: string | number) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage after mount to avoid server/client hydration mismatch.
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('safeeasy_open_chats');
        if (stored) {
            try {
                setOpenChats(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse stored chats", e);
            }
        }
        setIsLoaded(true);
    }
  }, []);

  // Save to localStorage whenever openChats changes
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
        localStorage.setItem('safeeasy_open_chats', JSON.stringify(openChats));
    }
  }, [openChats, isLoaded]);

  const openChat = (conversation: Conversation) => {
    setOpenChats(prev => {
      // Check if already open
      if (prev.find(c => String(c.id) === String(conversation.id))) {
        // If minimized, maximize it
        // Also update the conversation data with new info (e.g. new product context)
        return prev.map(c => String(c.id) === String(conversation.id) ? { ...c, ...conversation, isMinimized: false } : c);
      }
      // Limit to say 3 chats to avoid clutter
      const newChats = [...prev, { ...conversation, isMinimized: false }];
      if (newChats.length > 3) {
        return newChats.slice(newChats.length - 3);
      }
      return newChats;
    });
  };

  const closeChat = (conversationId: string | number) => {
    setOpenChats(prev => prev.filter(c => String(c.id) !== String(conversationId)));
  };

  const minimizeChat = (conversationId: string | number) => {
     setOpenChats(prev => prev.map(c => String(c.id) === String(conversationId) ? { ...c, isMinimized: true } : c));
  };
  
  const toggleChat = (conversationId: string | number) => {
     setOpenChats(prev => prev.map(c => String(c.id) === String(conversationId) ? { ...c, isMinimized: !c.isMinimized } : c));
  };

  return (
    <ChatContext.Provider value={{ openChats, openChat, closeChat, minimizeChat, toggleChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
