// app/(tabs)/messages.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getConversationPreviews, ConversationPreviewDTO, MessageDTO } from '../../utils/api';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { ChatHubEvents } from '../../hooks/useChatHub';

// Import các hàm cần thiết từ date-fns và date-fns-tz
import { parseISO, isToday as isTodayFn, isYesterday as isYesterdayFn } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'; // << SỬA Ở ĐÂY

import { API_BASE_URL } from '../../utils/api';

const DEFAULT_AVATAR = 'https://via.placeholder.com/50';
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'; // Định nghĩa múi giờ Việt Nam

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
      console.error('Failed to fetch conversations:', error);
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


  // --- HÀM FORMAT THỜI GIAN "LAST SEEN" THEO MÚI GIỜ VIỆT NAM ---
  const formatLastSeenInVietnam = (lastSeenIsoString: string | null | undefined): string => {
    if (!lastSeenIsoString) return 'Offline';

    try {
      // 1. Parse chuỗi ISO thành đối tượng Date (thời điểm này là UTC hoặc có offset từ chuỗi)
      const dateUtc = parseISO(lastSeenIsoString);

      // 2. Chuyển đổi thời điểm đó sang múi giờ Việt Nam để so sánh "ngày"
      const dateInVietnam = toZonedTime(dateUtc, VIETNAM_TIME_ZONE);
      const nowInVietnam = toZonedTime(new Date(), VIETNAM_TIME_ZONE);

      // 3. Kiểm tra xem có phải "hôm nay" hoặc "hôm qua" theo lịch Việt Nam không
      if (isTodayFn(dateInVietnam)) { // isTodayFn kiểm tra ngày của dateInVietnam
        return `Active today at ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
      }
      if (isYesterdayFn(dateInVietnam)) { // isYesterdayFn kiểm tra ngày của dateInVietnam
        return `Active yesterday at ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
      }

      // 4. Nếu không phải hôm nay hoặc hôm qua
      // So sánh năm để quyết định có hiển thị năm hay không
      if (dateInVietnam.getFullYear() === nowInVietnam.getFullYear()) {
        // Cùng năm, hiển thị "d MMM, HH:mm" (ví dụ: 20 Nov, 10:30)
        return `Seen ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM, HH:mm')}`;
      } else {
        // Khác năm, hiển thị "d MMM yyyy, HH:mm" (ví dụ: 20 Nov 2022, 10:30)
        return `Seen ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM yyyy, HH:mm')}`;
      }
    } catch (error) {
      console.error("Error formatting lastSeen date:", error, lastSeenIsoString);
      return "Recently"; // Giá trị mặc định nếu có lỗi
    }
  };

  // --- HÀM FORMAT TIMESTAMP CỦA TIN NHẮN CUỐI CÙNG THEO MÚI GIỜ VIỆT NAM ---
  const formatLastMessageTimestampInVietnam = (timestampIso: string | null | undefined): string => {
    if (!timestampIso) return '';
    try {
        const dateUtc = parseISO(timestampIso);
        // Hiển thị thời gian ngắn gọn, ví dụ: HH:mm nếu hôm nay, d MMM nếu khác
        const dateInVietnam = toZonedTime(dateUtc, VIETNAM_TIME_ZONE);
        const nowInVietnam = toZonedTime(new Date(), VIETNAM_TIME_ZONE);

        if (isTodayFn(dateInVietnam)) {
            return formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm'); // Ví dụ: 17:30
        }
        if (isYesterdayFn(dateInVietnam)) {
            return 'Yesterday'; // Hoặc 'Yesterday, HH:mm' tùy bạn
            // return `Yesterday, ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
        }
        if (dateInVietnam.getFullYear() === nowInVietnam.getFullYear()) {
            return formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM'); // Ví dụ: 20 Nov
        }
        return formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM yy'); // Ví dụ: 20 Nov 22
    } catch (error) {
        console.error("Error formatting last message timestamp:", error, timestampIso);
        return "Invalid date";
    }
  };


  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (!conversations.length && !loading) {
    return <View style={styles.centered}><Text>No conversations yet.</Text></View>;
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
               {/* Sử dụng hàm format mới cho timestamp của tin nhắn cuối cùng */}
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
      ListEmptyComponent={!loading ? <View style={styles.centered}><Text>No conversations yet.</Text></View> : null}
    />
  );
}

// Styles giữ nguyên như trước
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: 12, // Tăng padding dọc một chút
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', // Màu border nhạt hơn
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 15,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    width: 14, // Tăng kích thước một chút
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationDetails: {
    flex: 1,
    justifyContent: 'center', // Căn giữa các text nếu chiều cao khác nhau
  },
  username: {
    fontWeight: '600', // Đậm hơn một chút
    fontSize: 16,
    marginBottom: 2, // Khoảng cách với tin nhắn/status
  },
  lastMessage: {
    color: '#555', // Màu đậm hơn cho dễ đọc
    fontSize: 14,
  },
  statusText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 3,
  },
  onlineText: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  metaInfo: {
    alignItems: 'flex-end',
    marginLeft: 10,
    justifyContent: 'space-between', // Phân bố timestamp và unread badge
    height: '100%', // Để unreadBadge có thể căn dưới nếu timestamp ngắn
  },
  timestamp: {
    color: '#888', // Màu nhạt hơn cho timestamp
    fontSize: 12,
    marginBottom: 6, // Khoảng cách với unread badge
  },
  unreadBadge: {
    backgroundColor: '#EB3C58',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6, // Điều chỉnh padding
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
