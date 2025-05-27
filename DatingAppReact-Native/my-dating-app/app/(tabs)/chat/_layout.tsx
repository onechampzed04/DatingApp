// app/(tabs)/chat/_layout.tsx
import { Stack, useRouter, useLocalSearchParams, Link } from 'expo-router';
import { TouchableOpacity, Platform, View, Text, Image, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect, useLayoutEffect } from 'react'; // Thêm các hook cần thiết
import { useChat } from '../../context/ChatContext'; // Đường dẫn tới ChatContext
import { ChatHubEvents } from '../../../hooks/useChatHub'; // Đường dẫn tới ChatHubEvents
import { parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { isToday as isTodayFn, isYesterday as isYesterdayFn } from 'date-fns';

const DEFAULT_AVATAR = 'https://via.placeholder.com/40'; // Bạn có thể import từ constants
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Component ChatHeaderTitle (có thể copy từ ChatScreen.tsx hoặc tạo file riêng)
const ChatHeaderTitleComponent = ({ userName, avatarUrl, isOnline, lastSeen }: { userName: string; avatarUrl: string; isOnline?: boolean; lastSeen?: string | null }) => {
  const formatLastSeenHeader = (isoString: string | null | undefined): string => {
    if (!isoString) return 'Offline';
    try {
      const dateUtc = parseISO(isoString);
      const dateInVietnam = toZonedTime(dateUtc, VIETNAM_TIME_ZONE);
      const nowInVietnam = toZonedTime(new Date(), VIETNAM_TIME_ZONE);

      if (isTodayFn(dateInVietnam)) {
        return `Active today at ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
      }
      if (isYesterdayFn(dateInVietnam)) {
        return `Active yesterday at ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
      }
      return `Active ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'd MMM')}`;
    } catch {
      return 'Offline';
    }
  };
  return (
    <View style={styles.headerTitleContainer}>
      <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
      <View>
        <Text style={styles.headerUserName} numberOfLines={1}>{userName}</Text>
        {isOnline ? (
          <Text style={styles.headerStatusOnline}>Online</Text>
        ) : (
          <Text style={styles.headerStatusOffline}>{formatLastSeenHeader(lastSeen)}</Text>
        )}
      </View>
    </View>
  );
};


export default function ChatStackLayout() {
  const router = useRouter();
  // Lấy params cho màn hình [matchId] để cấu hình header động
  // Lưu ý: useLocalSearchParams ở đây sẽ lấy params của route hiện tại của Stack này,
  // không phải của screen con cụ thể nếu không có cách truyền trực tiếp.
  // Cách tốt hơn là để screen con tự quản lý header của nó.

  return (
    <Stack>
      <Stack.Screen name="[matchId]" />
      <Stack.Screen
        name="settings/[matchId]" // <-- THÊM SCREEN MỚI
        options={{
          // title: "Chat Settings", // Title sẽ được set động trong screen
          presentation: 'modal', // Hiển thị như một modal (tùy chọn)
                                  // hoặc để mặc định nếu muốn push bình thường
        }}
      />
      <Stack.Screen
        name="user-profile/[userId]"
        options={{
          title: "Profile", // Title mặc định, có thể bị ghi đè bởi screen
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 10 : 0, paddingHorizontal: 5 }}>
              <Ionicons name="arrow-back" size={28} color="#EA405A" />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}

// Styles cho Header (copy từ ChatScreen.tsx)
const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginLeft: Platform.OS === 'ios' ? -10 : 0, // Bỏ marginLeft này vì headerTitleAlign: 'left' đã xử lý
    maxWidth: '80%', // Giới hạn chiều rộng để không bị tràn
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  headerUserName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  headerStatusOnline: {
    fontSize: 12,
    color: '#4CAF50',
  },
  headerStatusOffline: {
    fontSize: 12,
    color: '#757575',
  },
});