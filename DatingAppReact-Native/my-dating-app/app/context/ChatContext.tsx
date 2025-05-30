// context/ChatContext.tsx
import React, { createContext, useContext, useEffect, ReactNode, useState, useCallback } from 'react';
import { useChatHub, ChatHubEvents } from '../../hooks/useChatHub'; // Corrected path, import ChatHubEvents
import { useAuth } from './AuthContext';
import { MessageDTO, AppNotification } from '../../utils/api'; // Import DTOs

// Extend ChatContextType to include unread status and reset functions
interface ChatContextType extends ReturnType<typeof useChatHub> {
  hasUnreadMessages: boolean;
  hasUnreadNotifications: boolean;
  resetUnreadMessages: () => void;
  resetUnreadNotifications: () => void;
}

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
  const { user, token, isLoading } = useAuth();

  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const resetUnreadMessages = useCallback(() => setHasUnreadMessages(false), []);
  const resetUnreadNotifications = useCallback(() => setHasUnreadNotifications(false), []);

  useEffect(() => {
    if (isLoading || !token || !chatHub.isConnected) return;

    const handlers: ChatHubEvents = {
      onReceiveMessage: (message: MessageDTO) => {
        // Assuming messages received via SignalR are inherently "unread" until processed by the chat screen
        // Also, ensure it's not a message sent by the current user if that logic is handled here.
        // For simplicity, any message received here that isn't from 'me' (if senderId is available and matches user.id)
        // could trigger the unread flag.
        console.log('ChatContext: Received message via SignalR.', message);
        // Example: if (message.senderUserID !== user?.id) { // Requires user object in this scope
        setHasUnreadMessages(true);
        // }
      },
      onReceiveAppNotification: (notification: AppNotification) => {
        console.log('ChatContext: Received app notification.', notification);
        if (!notification.isRead) {
          console.log('ChatContext: Notification is unread, setting unread flag for notifications.');
          setHasUnreadNotifications(true);
        } else {
          console.log('ChatContext: Notification is already read, not setting unread flag.');
        }
      },
      // Add other handlers from useChatHub if needed by other parts of the app
    };

    console.log('ChatContext: Preparing to register event handlers. Current handlers object keys:', Object.keys(handlers));
    chatHub.registerEventHandlers(handlers);
    console.log('ChatContext: Event handlers registration requested to ChatHub.');

    return () => {
      console.log('ChatContext: useEffect cleanup - requesting unregisterEventHandlers from ChatHub.');
      chatHub.unregisterEventHandlers();
      console.log('ChatContext: Event handlers unregistration requested to ChatHub.');
    };
  }, [chatHub.isConnected, chatHub.registerEventHandlers, chatHub.unregisterEventHandlers, token, isLoading]);


  useEffect(() => {
    if (isLoading) return;

    if (token && !chatHub.isConnected) {
      console.log('ChatProvider: User authenticated, attempting to connect to ChatHub.');
      chatHub.connect();
    } else if (!token && chatHub.isConnected) {
      console.log('ChatProvider: No token or user logged out, disconnecting from ChatHub.');
      chatHub.disconnect();
    }
  }, [token, chatHub.connect, chatHub.disconnect, chatHub.isConnected, isLoading]);

  const contextValue = {
    ...chatHub,
    hasUnreadMessages,
    hasUnreadNotifications,
    resetUnreadMessages,
    resetUnreadNotifications,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};
