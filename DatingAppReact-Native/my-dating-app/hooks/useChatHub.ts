// hooks/useChatHub.ts
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, MessageDTO, MessageTypeEnum, AppNotification, AppNotificationTypeEnum  } from '../utils/api'; // Adjust path to your api.ts

export interface ChatHubEvents  {
  onReceiveMessage?: (message: MessageDTO) => void;
  onMessagesRead?: (matchId: number, readerUserId: number, messageIds: number[]) => void;
  onNotifyTyping?: (matchId: number, typingUserId: number, userName: string) => void;
  onNotifyStoppedTyping?: (matchId: number, typingUserId: number) => void;
    onUserStatusChanged?: (userId: number, isOnline: boolean, lastSeen: string | null) => void; // << THÊM MỚI
      onReceiveAppNotification?: (notification: AppNotification) => void; // <<< THÊM DÒNG NÀY

}

export const useChatHub = () => {
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventHandlersRef = useRef<ChatHubEvents>({});

  const connect = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.error('ChatHub: No token found, cannot connect.');
      return;
    }

    if (connection && isConnected) {
      console.log('ChatHub: Already connected.');
      return connection;
    }

    try {
      const newConnection = new HubConnectionBuilder()
        .withUrl(`${API_BASE_URL}/chathub`, {
          accessTokenFactory: () => token,
        })
        .configureLogging(LogLevel.Information) // Or LogLevel.Debug for more details
        .withAutomaticReconnect()
        .build();

      newConnection.on('ReceiveMessage', (message: MessageDTO) => {
        console.log('ChatHub: ReceiveMessage', message);
        eventHandlersRef.current.onReceiveMessage?.(message);
      });

      newConnection.on('MessagesReadNotification', (matchId: number, readerUserId: number, messageIds: number[]) => {
        console.log('ChatHub: MessagesReadNotification', { matchId, readerUserId, messageIds });
        eventHandlersRef.current.onMessagesRead?.(matchId, readerUserId, messageIds);
      });

      newConnection.on('NotifyTyping', (matchId: number, typingUserId: number, userName: string) => {
        console.log('ChatHub: NotifyTyping', { matchId, typingUserId, userName });
        eventHandlersRef.current.onNotifyTyping?.(matchId, typingUserId, userName);
      });

      newConnection.on('NotifyStoppedTyping', (matchId: number, typingUserId: number) => {
         console.log('ChatHub: NotifyStoppedTyping', { matchId, typingUserId });
        eventHandlersRef.current.onNotifyStoppedTyping?.(matchId, typingUserId);
      });
        newConnection.on('UserStatusChanged', (userId: number, isOnline: boolean, lastSeen: string | null) => { // << ĐĂNG KÝ EVENT MỚI
        console.log('ChatHub: UserStatusChanged', { userId, isOnline, lastSeen });
        eventHandlersRef.current.onUserStatusChanged?.(userId, isOnline, lastSeen);
      });
      
      // Đăng ký lắng nghe sự kiện thông báo mới từ backend
      // Server is invoking 'receivenotification' (lowercase) based on console warning
      newConnection.on('receivenotification', (notification: AppNotification) => {
        console.log('ChatHub: receivenotification event received. Notification:', notification);
        if (eventHandlersRef.current.onReceiveAppNotification) {
          console.log('ChatHub: Found onReceiveAppNotification handler in ref, attempting to call it.');
          eventHandlersRef.current.onReceiveAppNotification(notification);
        } else {
          console.log('ChatHub: WARNING - onReceiveAppNotification handler is UNDEFINED in ref when event was received.');
        }
      });


      await newConnection.start();
      console.log('ChatHub: Connection started.');
      setConnection(newConnection);
      setIsConnected(true);
      return newConnection;
    } catch (e) {
      console.error('ChatHub: Connection failed: ', e);
      setIsConnected(false);
      setConnection(null);
    }
  }, [connection, isConnected]);

  const disconnect = useCallback(async () => {
    if (connection) {
      await connection.stop();
      console.log('ChatHub: Connection stopped.');
      setConnection(null);
      setIsConnected(false);
    }
  }, [connection]);

  const sendMessageViaHub = useCallback(async (messageDto: MessageDTO) => {
    // Note: The primary way to send messages is via the REST API
    // This function is here if you ever need direct hub invocation for sending
    // but `MessagesController.SendMessage` already handles broadcasting.
    // For now, it might not be used.
    if (connection && isConnected) {
      try {
        await connection.invoke('SendMessage', messageDto); // Ensure method name matches hub
      } catch (e) {
        console.error('ChatHub: Error sending message via hub: ', e);
      }
    }
  }, [connection, isConnected]);

  const sendUserStartedTyping = useCallback(async (matchId: number, typingUserId: number) => {
    if (connection && isConnected) {
      try {
        await connection.invoke('UserStartedTyping', matchId, typingUserId);
      } catch (e) {
        console.error('ChatHub: Error sending UserStartedTyping: ', e);
      }
    }
  }, [connection, isConnected]);

  const sendUserStoppedTyping = useCallback(async (matchId: number, typingUserId: number) => {
    if (connection && isConnected) {
      try {
        await connection.invoke('UserStoppedTyping', matchId, typingUserId);
      } catch (e) {
        console.error('ChatHub: Error sending UserStoppedTyping: ', e);
      }
    }
  }, [connection, isConnected]);

  const registerEventHandlers = useCallback((handlers: ChatHubEvents) => {
    console.log('ChatHub: registerEventHandlers called. Registering:', handlers);
    eventHandlersRef.current = handlers;
  }, []);
  
  const unregisterEventHandlers = useCallback(() => {
    console.log('ChatHub: unregisterEventHandlers called. Clearing handlers from ref.');
    eventHandlersRef.current = {};
  }, []);

  // Auto-disconnect on component unmount (if hook is used in a component)
  useEffect(() => {
    return () => {
      // This might lead to premature disconnection if the hook is used in a component
      // that unmounts while the app is still active. Better to manage connect/disconnect
      // at a higher level, e.g., in ChatContext or based on app lifecycle.
      // For now, we keep it simple.
      // disconnect(); 
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected,
    registerEventHandlers,
    unregisterEventHandlers,
    // sendMessageViaHub, // Not typically used as REST API handles sending & broadcasting
    sendUserStartedTyping,
    sendUserStoppedTyping,
  };
};
