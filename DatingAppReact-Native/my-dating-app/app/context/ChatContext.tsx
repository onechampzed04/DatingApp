// context/ChatContext.tsx
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useChatHub } from '../../hooks/useChatHub'; // Corrected path
import { useAuth } from './AuthContext';

// ChatContextType should be inferred or explicitly defined based on useChatHub's return
// For now, extending ReturnType<typeof useChatHub> is fine.
interface ChatContextType extends ReturnType<typeof useChatHub> {}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const chatHub = useChatHub();
  // Assuming useAuth() provides a separate token field
  const { user, token, isLoading } = useAuth(); // Get token directly from useAuth

  useEffect(() => {
    if (isLoading) return; // Don't do anything if auth state is still loading

    if (token && !chatHub.isConnected) {
      console.log('ChatProvider: User authenticated with token, attempting to connect to ChatHub.');
      chatHub.connect();
    } else if (!token && chatHub.isConnected) {
      console.log('ChatProvider: No token or user logged out, disconnecting from ChatHub.');
      chatHub.disconnect();
    }

    // No explicit cleanup needed here for connect/disconnect as it's based on token presence.
    // The useChatHub hook itself could have an internal cleanup for its connection.
  }, [token, chatHub.connect, chatHub.disconnect, chatHub.isConnected, isLoading]); // Added isLoading

  return (
    <ChatContext.Provider value={chatHub}>
      {children}
    </ChatContext.Provider>
  );
};