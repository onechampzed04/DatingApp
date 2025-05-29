// app/(tabs)/notifications.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image, RefreshControl, Alert, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

import {
  getAppNotifications,
  markAppNotificationAsRead,
  markAllAppNotificationsAsRead,
  AppNotification,
  AppNotificationTypeEnum,
  API_BASE_URL, // Import API_BASE_URL
} from '../../utils/api'; // Đảm bảo đường dẫn chính xác
import { useAuth } from '../context/AuthContext'; // Đảm bảo đường dẫn chính xác
import { useChat } from '../context/ChatContext';   // Đảm bảo đường dẫn chính xác
import { ChatHubEvents } from '../../hooks/useChatHub'; // Đảm bảo đường dẫn chính xác

const DEFAULT_AVATAR_NOTIF = require('../../assets/images/dating-app.png'); // Đường dẫn đến ảnh avatar mặc định

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { registerEventHandlers, unregisterEventHandlers, isConnected } = useChat(); // Lấy từ ChatContext
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 15;

  const fetchNotifications = useCallback(async (isRefresh = false) => {
  if (!user || (!hasMore && !isRefresh) || (loadingMore && !isRefresh)) return;

  console.log(`[fetchNotifications] Called. isRefresh: ${isRefresh}, pageNumber: ${pageNumber}, hasMore: ${hasMore}, loadingMore: ${loadingMore}`);

  if (isRefresh) {
    setRefreshing(true);
    setPageNumber(1);
    // setNotifications([]); // Delay this to see previous state if needed for debugging, or keep to clear immediately
    setHasMore(true);
    console.log('[fetchNotifications] Refreshing: pageNumber reset to 1, notifications will be cleared.');
  } else if (pageNumber === 1) {
    setLoading(true);
    console.log('[fetchNotifications] Initial load: setLoading(true)');
  } else {
    setLoadingMore(true);
    console.log('[fetchNotifications] Loading more: setLoadingMore(true)');
  }

  try {
    const pageToFetch = isRefresh ? 1 : pageNumber;
    console.log(`[fetchNotifications] Attempting to fetch page: ${pageToFetch}`);
    const rawFetchedNotifications = await getAppNotifications(pageToFetch, PAGE_SIZE);
    console.log('[fetchNotifications] Raw fetchedNotifications from API:', JSON.stringify(rawFetchedNotifications, null, 2));

    // Map notificationID to id
    const fetchedNotifications: AppNotification[] = rawFetchedNotifications.map((notif: any) => ({
      ...notif,
      id: notif.notificationID, // Map notificationID to id
    }));
    console.log('[fetchNotifications] Mapped fetchedNotifications (with id field):', JSON.stringify(fetchedNotifications, null, 2));
    
    if (fetchedNotifications.length < PAGE_SIZE) {
      setHasMore(false);
      console.log('[fetchNotifications] Fetched less than PAGE_SIZE, setting hasMore to false.');
    }

    setNotifications(prev => {
      console.log('[fetchNotifications] setNotifications - prevNotifications count:', prev.length);
      const validNotifications = fetchedNotifications.filter(
        n => n.id && typeof n.id === 'string' // Now this should work
      );
      console.log('[fetchNotifications] setNotifications - validNotifications count:', validNotifications.length);
      if (validNotifications.length !== fetchedNotifications.length) {
        // This warning might still appear if other fields are missing, but id should be fine.
        console.warn('[fetchNotifications] Some fetched notifications might still have issues after mapping, or were invalid before mapping.');
      }

      const newItems = validNotifications.filter(
        newItem => !prev.some(existingItem => existingItem.id === newItem.id)
      );
      console.log('[fetchNotifications] setNotifications - newItems to add (after duplicate check):', newItems.length);
      
      const updated = isRefresh ? newItems : [...prev, ...newItems];
      console.log('[fetchNotifications] setNotifications - updatedNotifications count:', updated.length);
      return updated;
    });

    if (fetchedNotifications.length > 0 && !isRefresh) {
      setPageNumber(prevPage => prevPage + 1);
    }
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    Alert.alert("Lỗi", "Không thể tải thông báo. Vui lòng thử lại.");
  } finally {
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }
}, [user, pageNumber, hasMore, loadingMore]);

  // Tải thông báo khi màn hình được focus hoặc khi user thay đổi
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchNotifications(true); // Refresh khi focus
      }
    }, [user]) // Chỉ fetchNotifications khi user thay đổi, fetchNotifications đã có isRefresh
  );


  // Lắng nghe sự kiện SignalR
  useEffect(() => {
    if (!isConnected || !user) return;

    const handlers: ChatHubEvents = {
  onReceiveAppNotification: (newNotification: AppNotification) => {
    console.log('Received new notification via SignalR:', newNotification);

    // Validate that newNotification.id exists and is a string
    if (!newNotification.id || typeof newNotification.id !== 'string') {
      console.warn('Invalid notification received via SignalR: missing or invalid id', newNotification);
      return; // Skip adding this notification to the state
    }

    setNotifications(prevNotifications => {
      // Kiểm tra xem thông báo đã tồn tại chưa để tránh trùng lặp
      if (prevNotifications.some(n => n.id === newNotification.id)) {
        console.log('Notification already exists, skipping:', newNotification.id);
        return prevNotifications;
      }

      // Thêm vào đầu danh sách và sắp xếp lại theo createdAt (mới nhất trước)
      const updatedNotifications = [newNotification, ...prevNotifications].sort(
        (a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()
      );
      return updatedNotifications;
    });

    // TODO: Có thể hiển thị một in-app notification banner
  },
  // Các handlers khác nếu cần
};

    registerEventHandlers(handlers);
    return () => {
      unregisterEventHandlers();
    };
  }, [isConnected, user, registerEventHandlers, unregisterEventHandlers]);


  const handleNotificationPress = async (notification: AppNotification) => {
    // Đánh dấu đã đọc
    if (!notification.isRead) {
      try {
        await markAppNotificationAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Điều hướng dựa trên loại thông báo
    switch (notification.notificationType) {
      case AppNotificationTypeEnum.NewMatch:
        // Giả sử referenceID là MatchID, bạn có thể muốn điều hướng đến màn hình chat
        // Hoặc profile của người match
        if (notification.referenceID && notification.senderUserID) {
          // Cần thông tin của người match (sender) để mở chat
          // Có thể bạn cần lấy thêm thông tin user từ senderUserID
          router.push({
            pathname: `../(tabs)/chat/${notification.referenceID}`, // referenceID là MatchID
            params: {
              matchedUserID: notification.senderUserID.toString(),
              matchedUserName: notification.senderUsername || 'User',
              matchedUserAvatar: notification.senderAvatar || '',
              // Các params khác nếu cần thiết cho màn hình chat
            },
          });
        }
        break;
      case AppNotificationTypeEnum.PostReaction:
      case AppNotificationTypeEnum.PostComment:
        // Điều hướng đến bài viết
        if (notification.referenceID) {
          router.push(`/post-detail/${notification.referenceID}`); // referenceID là PostID
        }
        break;
      case AppNotificationTypeEnum.CommentReply:
        // Điều hướng đến bài viết và scroll đến comment (phức tạp hơn)
        // Hoặc chỉ đến bài viết
        if (notification.referenceID) { // referenceID ở đây có thể là PostID hoặc CommentID gốc
                                       // Backend nên gửi PostID trong referenceID cho CommentReply để dễ điều hướng
           const postIdForReply = notification.messageText.includes("bài viết") ? notification.referenceID : null; // Cần logic tốt hơn để lấy postId
           if(postIdForReply) { // Cần đảm bảo referenceID ở đây là PostID
             router.push(`/post-detail/${postIdForReply}`); // Tạm thời điều hướng đến post
           } else {
            // Nếu referenceID là commentID, bạn cần logic để tìm PostID từ CommentID
            console.warn("Cannot determine PostID for CommentReply notification:", notification);
           }
        }
        break;
      case AppNotificationTypeEnum.NewMessage:
         if (notification.referenceID && notification.senderUserID) { // referenceID là MatchID
            router.push({
                pathname: `../(tabs)/chat/${notification.referenceID}`,
                params: {
                    matchedUserID: notification.senderUserID.toString(),
                    matchedUserName: notification.senderUsername || 'User',
                    matchedUserAvatar: notification.senderAvatar || '',
                },
            });
         }
        break;
      default:
        console.log('Unhandled notification type:', notification.notificationType);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAppNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      Alert.alert("Thành công", "Đã đánh dấu tất cả thông báo là đã đọc.");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      Alert.alert("Lỗi", "Không thể đánh dấu tất cả là đã đọc.");
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNowStrict(parseISO(dateString), { addSuffix: true, locale: vi });
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return "không xác định";
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const avatarSource = item.senderAvatar
      ? { uri: item.senderAvatar.startsWith('http') ? item.senderAvatar : `${API_BASE_URL}${item.senderAvatar}` }
      : DEFAULT_AVATAR_NOTIF;

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}
      >
        <Image source={avatarSource} style={styles.avatar} />
        <View style={styles.notificationContent}>
          <Text style={styles.message}>{item.messageText}</Text>
          <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading && pageNumber === 1 && notifications.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#EA405A" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thông báo</Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Ionicons name="checkmark-done-circle-outline" size={28} color="#EA405A" />
        </TouchableOpacity>
      </View>
      {notifications.length === 0 && !loading && !refreshing ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>Bạn chưa có thông báo nào.</Text>
        </View>
      ) : (
        <FlatList
  data={notifications}
  renderItem={renderItem}
  keyExtractor={(item) => (item.id ? item.id.toString() : Math.random().toString())} // Fallback to random string if id is invalid
  contentContainerStyle={styles.listContentContainer}
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} colors={["#EA405A"]} />
  }
  onEndReached={() => {
    if (hasMore && !loadingMore) {
      fetchNotifications(false);
    }
  }}
  onEndReachedThreshold={0.5}
  ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} color="#EA405A" /> : null}
/>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Màu nền sáng hơn một chút
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 16, // Điều chỉnh padding top cho an toàn
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 22, // Giảm kích thước một chút
    fontWeight: 'bold',
    color: '#333',
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    alignItems: 'center', // Căn giữa avatar và nội dung
  },
  unreadNotification: {
    backgroundColor: '#E9F5FF', // Màu nền nhẹ cho thông báo chưa đọc
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 15,
  },
  notificationContent: {
    flex: 1, // Để text có thể wrap
  },
  message: {
    fontSize: 15, // Tăng kích thước chữ
    color: '#333333',
    marginBottom: 3,
  },
  time: {
    fontSize: 12,
    color: '#757575', // Màu xám đậm hơn
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF', // Màu xanh dương cho unread dot
    marginLeft: 10,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
  },
});
