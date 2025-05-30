// app/(tabs)/messages.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getConversationPreviews, ConversationPreviewDTO, MessageDTO } from '../../utils/api';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { ChatHubEvents } from '../../hooks/useChatHub';
import { parseISO, isToday as isTodayFn, isYesterday as isYesterdayFn } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

import { API_BASE_URL } from '../../utils/api';

const DEFAULT_AVATAR = 'https://via.placeholder.com/50';
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { registerEventHandlers, unregisterEventHandlers, isConnected } = useChat();
  const [conversations, setConversations] = useState<ConversationPreviewDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUserId = user?.userId ?? -1;

  const fetchConversations = useCallback(async () => {
    if (currentUserId === -1) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const previews = await getConversationPreviews();
      previews.sort((a, b) => {
        if (a.isMatchedUserOnline && !b.isMatchedUserOnline) return -1;
        if (!a.isMatchedUserOnline && b.isMatchedUserOnline) return 1;
        const timeA = a.lastMessageTimestamp ? parseISO(a.lastMessageTimestamp).getTime() : 0;
        const timeB = b.lastMessageTimestamp ? parseISO(b.lastMessageTimestamp).getTime() : 0;
        return timeB - timeA;
      });
      setConversations(previews);
    } catch (error) {
      console.error('Failed"\
to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  useEffect(() => {
    if (!isConnected || currentUserId === -1) return;

    const handlers: ChatHubEvents = {
      onReceiveMessage: (newMessage: MessageDTO) => {
        setConversations(prevConvos => {
          const existingConvoIndex = prevConvos.findIndex(c => c.matchID === newMessage.matchID);
          let updatedConvos = [...prevConvos];

          if (existingConvoIndex > -1) {
            const convoToUpdate = { ...updatedConvos[existingConvoIndex] };
            convoToUpdate.lastMessageContent = newMessage.content;
            convoToUpdate.lastMessageTimestamp = newMessage.timestamp;
            convoToUpdate.isLastMessageFromMe = newMessage.senderUserID === currentUserId;
            if (!convoToUpdate.isLastMessageFromMe && newMessage.senderUserID !== currentUserId) {
              convoToUpdate.unreadCount = (convoToUpdate.unreadCount || 0) + 1;
            }
            updatedConvos[existingConvoIndex] = convoToUpdate;
          } else {
            const newPreview: ConversationPreviewDTO = {
              matchID: newMessage.matchID,
              matchedUserID: newMessage.senderUserID === currentUserId ? newMessage.receiverUserID : newMessage.senderUserID,
              matchedUsername: newMessage.senderFullName || "New Chat",
              matchedUserAvatar: newMessage.senderAvatar || DEFAULT_AVATAR,
              lastMessageContent: newMessage.content,
              lastMessageTimestamp: newMessage.timestamp,
              unreadCount: newMessage.senderUserID === currentUserId ? 0 : 1,
              isLastMessageFromMe: newMessage.senderUserID === currentUserId,
              isMatchedUserOnline: false,
              matchedUserLastSeen: null,
            };
            updatedConvos.push(newPreview);
          }
          return updatedConvos.sort((a, b) => {
            if (a.isMatchedUserOnline && !b.isMatchedUserOnline) return -1;
            if (!a.isMatchedUserOnline && b.isMatchedUserOnline) return 1;
            const timeA = a.lastMessageTimestamp ? parseISO(a.lastMessageTimestamp).getTime() : 0;
            const timeB = b.lastMessageTimestamp ? parseISO(b.lastMessageTimestamp).getTime() : 0;
            return timeB - timeA;
          });
        });
      },
      onMessagesRead: (matchId: number, readerUserId: number) => {
        if (readerUserId === currentUserId) {
          setConversations(prev => prev.map(c =>
            c.matchID === matchId ? { ...c, unreadCount: 0 } : c
          ));
        }
      },
      onUserStatusChanged: (changedUserId: number, isOnline: boolean, lastSeen: string | null) => {
        setConversations(prevConvos =>
          prevConvos.map(convo => {
            if (convo.matchedUserID === changedUserId) {
              return {
                ...convo,
                isMatchedUserOnline: isOnline,
                matchedUserLastSeen: lastSeen,
              };
            }
            return convo;
          }).sort((a, b) => {
            if (a.isMatchedUserOnline && !b.isMatchedUserOnline) return -1;
            if (!a.isMatchedUserOnline && b.isMatchedUserOnline) return 1;
            const timeA = a.lastMessageTimestamp ? parseISO(a.lastMessageTimestamp).getTime() : 0;
            const timeB = b.lastMessageTimestamp ? parseISO(b.lastMessageTimestamp).getTime() : 0;
            return timeB - timeA;
          })
        );
      }
    };
    registerEventHandlers(handlers);
    return () => unregisterEventHandlers();
  }, [isConnected, registerEventHandlers, unregisterEventHandlers, currentUserId]);

  const formatLastSeenInVietnam = (lastSeenIsoString: string | null | undefined): string => {
    if (!lastSeenIsoString) return 'Offline';
    try {
      const dateUtc = parseISO(lastSeenIsoString);
      const dateInVietnam = toZonedTime(dateUtc, VIETNAM_TIME_ZONE);
      const nowInVietnam = toZonedTime(new Date(), VIETNAM_TIME_ZONE);
      if (isTodayFn(dateInVietnam)) {
        return `Active today at ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
      }
      if (isYesterdayFn(dateInVietnam)) {
        return `Active yesterday at ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
      }
      if (dateInVietnam.getFullYear() === nowInVietnam.getFullYear()) {
        return `Seen ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM, HH:mm')}`;
      }
      return `Seen ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM yyyy, HH:mm')}`;
    } catch (error) {
      console.error("Error formatting lastSeen date:", error, lastSeenIsoString);
      return "Recently";
    }
  };

  const formatLastMessageTimestampInVietnam = (timestampIso: string | null | undefined): string => {
    if (!timestampIso) return '';
    try {
      const dateUtc = parseISO(timestampIso);
      const dateInVietnam = toZonedTime(dateUtc, VIETNAM_TIME_ZONE);
      const nowInVietnam = toZonedTime(new Date(), VIETNAM_TIME_ZONE);
      if (isTodayFn(dateInVietnam)) {
        return formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm');
      }
      if (isYesterdayFn(dateInVietnam)) {
        return 'Yesterday';
      }
      if (dateInVietnam.getFullYear() === nowInVietnam.getFullYear()) {
        return formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM');
      }
      return formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM yy');
    } catch (error) {
      console.error("Error formatting last message timestamp:", error, timestampIso);
      return "Invalid date";
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#E5435A" /></View>;
  }

  if (!conversations.length && !loading) {
    return <View style={styles.centered}><Text style={styles.emptyText}>No conversations yet.</Text></View>;
  }

  const renderItem = ({ item }: { item: ConversationPreviewDTO }) => {
    const avatarUrl = item.matchedUserAvatar
      ? (item.matchedUserAvatar.startsWith('http') ? item.matchedUserAvatar : `${API_BASE_URL}${item.matchedUserAvatar}`)
      : DEFAULT_AVATAR;

    const encodedAvatarForNav = item.matchedUserAvatar
      ? (item.matchedUserAvatar.startsWith('http') ? item.matchedUserAvatar : `${API_BASE_URL}${item.matchedUserAvatar}`)
      : DEFAULT_AVATAR;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => {
          router.push(`/chat/${item.matchID}?matchedUserName=${encodeURIComponent(item.matchedUsername || 'Chat')}&matchedUserAvatar=${encodeURIComponent(encodedAvatarForNav)}&matchedUserID=${item.matchedUserID}&isMatchedUserOnline=${item.isMatchedUserOnline}&matchedUserLastSeen=${item.matchedUserLastSeen || ''}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          {item.isMatchedUserOnline && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.conversationDetails}>
          <Text style={styles.username}>{item.matchedUsername || 'Unknown User'}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.isLastMessageFromMe ? 'You: ' : ''}{item.lastMessageContent || 'No messages yet'}
          </Text>
          {!item.isMatchedUserOnline && item.matchedUserLastSeen && (
            <Text style={styles.statusText}>
              {formatLastSeenInVietnam(item.matchedUserLastSeen)}
            </Text>
          )}
          {item.isMatchedUserOnline && (
            <Text style={[styles.statusText, styles.onlineText]}>Online</Text>
          )}
        </View>
        <View style={styles.metaInfo}>
          {item.lastMessageTimestamp && (
            <Text style={styles.timestamp}>
              {formatLastMessageTimestampInVietnam(item.lastMessageTimestamp)}
            </Text>
          )}
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={conversations}
      renderItem={renderItem}
      keyExtractor={(item) => item.matchID.toString()}
      style={styles.container}
      ListEmptyComponent={!loading ? <View style={styles.centered}><Text style={styles.emptyText}>No conversations yet.</Text></View> : null}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8', // Soft gray background for consistency with PostsScreen
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F5F6F8',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5435A11', // Subtle primary color border
  },
  avatarContainer: {
    marginRight: 15,
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E5435A',
    backgroundColor: '#F5F6F8', // Fallback background
  },
  onlineIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5435A', // Use primary color for online indicator
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontWeight: '700',
    fontSize: 17,
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    color: '#555',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  statusText: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
    fontWeight: '400',
  },
  onlineText: {
    color: '#E5435A', // Match primary color
    fontWeight: '600',
  },
  metaInfo: {
    alignItems: 'flex-end',
    marginLeft: 10,
    justifyContent: 'center',
  },
  timestamp: {
    color: '#888',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 8,
  },
  unreadBadge: {
    backgroundColor: '#E5435A',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});