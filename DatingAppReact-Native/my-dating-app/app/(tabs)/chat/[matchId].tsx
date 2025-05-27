import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ColorValue } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, Link, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { isToday as isTodayFn, isYesterday as isYesterdayFn } from 'date-fns';
import {
  getMessagesForMatch,
  sendMessage,
  markMessagesAsRead,
  uploadChatMedia,
  MessageDTO,
  MessageTypeEnum,
  SendMessageDTO,
  ExpoImageFile,
  API_BASE_URL,
} from '../../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { ChatHubEvents } from '../../../hooks/useChatHub';
import Ionicons from '@expo/vector-icons/Ionicons';

const DEFAULT_AVATAR = 'https://via.placeholder.com/40';
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

interface ThemeOption {
  id: string;
  name: string;
  gradientColors: [ColorValue, ColorValue, ...ColorValue[]];
  textColor: string;
  myMessageBubbleColor: string;
  otherMessageBubbleColor: string;
}

const localDefaultThemes: ThemeOption[] = [
  { id: 'default', name: 'Default', gradientColors: ['#F4F4F8', '#EAEAF8'], textColor: '#000000', myMessageBubbleColor: '#EA405A', otherMessageBubbleColor: '#E9E9EB' },
  { id: 'ocean', name: 'Ocean Blue', gradientColors: ['#2193b0', '#6dd5ed'], textColor: '#FFFFFF', myMessageBubbleColor: '#0B486B', otherMessageBubbleColor: '#3B8686' },
  { id: 'sunset', name: 'Sunset Orange', gradientColors: ['#ff7e5f', '#feb47b'], textColor: '#FFFFFF', myMessageBubbleColor: '#D35400', otherMessageBubbleColor: '#F39C12' },
  { id: 'forest', name: 'Forest Green', gradientColors: ['#5A3F37', '#2C7744'], textColor: '#FFFFFF', myMessageBubbleColor: '#1E4620', otherMessageBubbleColor: '#4A5D23' },
  { id: 'lavender', name: 'Lavender Bliss', gradientColors: ['#B2A4FF', '#D6D2FF'], textColor: '#332E5E', myMessageBubbleColor: '#6046FF', otherMessageBubbleColor: '#E1DDFF' },
];

const getThemeStorageKeyChat = (matchIdParam: string) => `chatTheme_match_${matchIdParam}`;

// Component cho phần title của header
const ChatHeaderTitle = ({ userName, avatarUrl, isOnline, lastSeen }: { userName: string; avatarUrl: string; isOnline?: boolean; lastSeen?: string | null }) => {
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
        <Text style={styles.headerUserName}>{userName}</Text>
        {isOnline ? (
          <Text style={styles.headerStatusOnline}>Online</Text>
        ) : (
          <Text style={styles.headerStatusOffline}>{formatLastSeenHeader(lastSeen)}</Text>
        )}
      </View>
    </View>
  );
};

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    matchId: string;
    matchedUserName?: string;
    matchedUserAvatar?: string;
    matchedUserID?: string;
    isMatchedUserOnline?: string;
    matchedUserLastSeen?: string;
  }>();

  const matchIdString = params.matchId;
  if (!matchIdString) {
    if (router.canGoBack()) router.back();
    return <View style={styles.centered}><Text>Error: Chat not found.</Text></View>;
  }
  const matchId = parseInt(matchIdString, 10);
  const matchedUserID = params.matchedUserID ? parseInt(params.matchedUserID, 10) : undefined;

  const [matchedUserName, setMatchedUserName] = useState(params.matchedUserName || 'Chat');
  const [matchedUserAvatar, setMatchedUserAvatar] = useState(params.matchedUserAvatar || DEFAULT_AVATAR);
  const navParamAvatar = params.matchedUserAvatar;
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(params.isMatchedUserOnline === 'true');
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<string | null>(params.matchedUserLastSeen || null);
  const [currentTheme, setCurrentTheme] = useState<ThemeOption | null>(null);
  const [themeLoading, setThemeLoading] = useState(true);

  const { user } = useAuth();
  const { registerEventHandlers, unregisterEventHandlers, isConnected, sendUserStartedTyping, sendUserStoppedTyping } = useChat();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [otherUserTyping, setOtherUserTyping] = useState<string | null>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserId = user?.userId ?? -1;

  useFocusEffect(
    useCallback(() => {
      const loadTheme = async () => {
        if (matchIdString) {
          setThemeLoading(true);
          try {
            const storedThemeId = await AsyncStorage.getItem(getThemeStorageKeyChat(matchIdString));
            const themeToApply = localDefaultThemes.find(t => t.id === storedThemeId) || localDefaultThemes[0];
            setCurrentTheme(themeToApply);
          } catch (error) {
            console.error("Failed to load theme in ChatScreen:", error);
            setCurrentTheme(localDefaultThemes[0]);
          } finally {
            setThemeLoading(false);
          }
        } else {
          setCurrentTheme(localDefaultThemes[0]);
          setThemeLoading(false);
        }
      };
      loadTheme();
    }, [matchIdString])
  );

  const fetchMessages = useCallback(async (page = 1) => {
    if (isNaN(matchId)) return;
    if (!hasMoreMessages && page > 1) return;
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const newMessages = await getMessagesForMatch(matchId, page, 20);
      if (newMessages.length < 20) {
        setHasMoreMessages(false);
      }
      setMessages(prev => page === 1 ? newMessages.sort((a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime())
                                   : [...newMessages.sort((a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime()), ...prev]);
      if (page === 1) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      if (page === 1) setLoading(false); else setLoadingMore(false);
    }
  }, [matchId, hasMoreMessages]);

  useEffect(() => {
    if (!isNaN(matchId)) {
      fetchMessages(1);
      markMessagesAsRead(matchId).catch(console.error);
    }
  }, [fetchMessages, matchId]);

  useEffect(() => {
    if (!isConnected || !user || currentUserId === -1 || isNaN(matchId)) return;

    const handlers: ChatHubEvents = {
      onReceiveMessage: (newMessage: MessageDTO) => {
        if (newMessage.matchID === matchId) {
          setMessages(prev => [...prev, newMessage].sort((a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime()));
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          if (newMessage.senderUserID !== currentUserId) {
            markMessagesAsRead(matchId).catch(console.error);
          }
        }
      },
      onMessagesRead: (readMatchId: number, readerUserId: number, messageIds: number[]) => {
        if (readMatchId === matchId && readerUserId !== currentUserId) {
          setMessages(prev =>
            prev.map(msg =>
              messageIds.includes(msg.messageID) && msg.senderUserID === currentUserId
                ? { ...msg, isRead: true }
                : msg
            )
          );
        }
      },
      onNotifyTyping: (typingMatchId: number, typingUserId: number, userName: string) => {
        if (typingMatchId === matchId && typingUserId !== currentUserId) {
          setOtherUserTyping(userName);
        }
      },
      onNotifyStoppedTyping: (typingMatchId: number, typingUserId: number) => {
        if (typingMatchId === matchId && typingUserId !== currentUserId) {
          setOtherUserTyping(null);
        }
      },
      onUserStatusChanged: (changedUserId: number, isOnline: boolean, lastSeen: string | null) => {
        if (changedUserId === matchedUserID) {
          setIsOtherUserOnline(isOnline);
          setOtherUserLastSeen(lastSeen);
        }
      },
    };
    registerEventHandlers(handlers);
    return () => unregisterEventHandlers();
  }, [isConnected, registerEventHandlers, unregisterEventHandlers, matchId, user, currentUserId, matchedUserID]);

  useLayoutEffect(() => {
    setMatchedUserName(params.matchedUserName || 'Chat');
    setMatchedUserAvatar(params.matchedUserAvatar || DEFAULT_AVATAR);
    if (params.isMatchedUserOnline !== undefined) {
      setIsOtherUserOnline(params.isMatchedUserOnline === 'true');
    }
    if (params.matchedUserLastSeen !== undefined) {
      setOtherUserLastSeen(params.matchedUserLastSeen);
    }
  }, [params.matchedUserName, params.matchedUserAvatar, params.isMatchedUserOnline, params.matchedUserLastSeen]);

  const handleSend = async (type: MessageTypeEnum = MessageTypeEnum.Text, mediaUrl?: string, contentInput?: string) => {
    if (isNaN(matchId) || currentUserId === -1) return;
    const messageContent = contentInput || inputText;
    if (!messageContent.trim() && !mediaUrl) return;

    const dto: SendMessageDTO = {
      matchID: matchId,
      content: messageContent,
      type: mediaUrl ? type : MessageTypeEnum.Text,
      mediaUrl: mediaUrl,
    };

    try {
      setInputText('');
      await sendMessage(dto);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        sendUserStoppedTyping(matchId, currentUserId);
        typingTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert("Error", "Could not send message.");
    }
  };

  const handlePickMedia = async (pickerMediaType: 'Images' | 'Videos') => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: pickerMediaType === 'Images' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: pickerMediaType === 'Images',
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const file: ExpoImageFile = {
        uri: asset.uri,
        name: asset.fileName || `chat-media-${Date.now()}.${asset.uri.split('.').pop()}`,
        type: asset.mimeType || (pickerMediaType === 'Images' ? 'image/jpeg' : 'video/mp4'),
      };
      try {
        Alert.alert("Uploading...", "Your media is being uploaded.");
        const uploadResponse = await uploadChatMedia(file);
        handleSend(
          pickerMediaType === 'Images' ? MessageTypeEnum.Image : MessageTypeEnum.Video,
          uploadResponse.url,
          inputText.trim() || (pickerMediaType === 'Images' ? "Image" : "Video")
        );
        setInputText('');
      } catch (error) {
        console.error('Failed to upload media:', error);
        Alert.alert("Upload Failed", "Could not upload media.");
      }
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!isConnected || isNaN(matchId) || currentUserId === -1) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      sendUserStartedTyping(matchId, currentUserId);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isConnected) {
        sendUserStoppedTyping(matchId, currentUserId);
      }
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const renderMessageItem = ({ item }: { item: MessageDTO }) => {
    const isMyMessage = currentUserId !== -1 && item.senderUserID === currentUserId;
    let senderAvatarDisplayUrl = DEFAULT_AVATAR;

    if (item.senderAvatar) {
      senderAvatarDisplayUrl = item.senderAvatar.startsWith('http')
        ? item.senderAvatar
        : `${API_BASE_URL}${item.senderAvatar}`;
    } else if (navParamAvatar && navParamAvatar !== DEFAULT_AVATAR) {
      senderAvatarDisplayUrl = navParamAvatar;
    }

    const isDefaultImageCaption = item.type === MessageTypeEnum.Image && item.content === "Image";
    const isDefaultVideoCaption = item.type === MessageTypeEnum.Video && item.content === "Video";
    const shouldHideDefaultCaption = isDefaultImageCaption || isDefaultVideoCaption;
    const dateObject = parseISO(item.timestamp);

    return (
      <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}>
        {!isMyMessage && (
          <Image source={{ uri: senderAvatarDisplayUrl }} style={styles.avatar} />
        )}
        <View style={[
          styles.messageBubble,
          isMyMessage
            ? { backgroundColor: currentTheme?.myMessageBubbleColor || styles.myMessageBubble.backgroundColor }
            : { backgroundColor: currentTheme?.otherMessageBubbleColor || styles.otherMessageBubble.backgroundColor },
          isMyMessage ? styles.myMessageBubbleTail : styles.otherMessageBubbleTail
        ]}>
          {item.type === MessageTypeEnum.Image && item.mediaUrl && (
            <Image source={{ uri: `${API_BASE_URL}${item.mediaUrl}` }} style={styles.mediaImage} resizeMode="contain" />
          )}
          {item.type === MessageTypeEnum.Video && item.mediaUrl && (
            <Video
              source={{ uri: `${API_BASE_URL}${item.mediaUrl}` }}
              style={styles.mediaVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
            />
          )}
          {item.content && item.content.trim() !== "" && !shouldHideDefaultCaption && (item.type === MessageTypeEnum.Text || item.mediaUrl) && (
            <Text style={[
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
              { color: currentTheme?.textColor }
            ]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageInfo}>
            <Text style={[styles.timestamp, { color: isMyMessage ? 'rgba(255,255,255,0.7)' : currentTheme?.textColor ? `${currentTheme.textColor}99` : 'rgba(0,0,0,0.4)' }]}>
              {formatInTimeZone(dateObject, VIETNAM_TIME_ZONE, 'p')}
            </Text>
            {isMyMessage && item.isRead && <Ionicons name="checkmark-done" size={14} color="#4FC3F7" style={{ marginLeft: 5 }} />}
            {isMyMessage && !item.isRead && <Ionicons name="checkmark" size={14} color={isMyMessage ? "rgba(255,255,255,0.7)" : "grey"} style={{ marginLeft: 5 }} />}
          </View>
        </View>
      </View>
    );
  };

  const loadMoreMessages = () => {
    if (!loadingMore && hasMoreMessages && !isNaN(matchId)) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchMessages(nextPage);
    }
  };

  if (themeLoading || (loading && currentPage === 1)) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }
  if (!currentTheme) {
    return <View style={styles.centered}><Text>Loading theme...</Text></View>;
  }
  if (isNaN(matchId)) {
    return <View style={styles.centered}><Text>Invalid Chat ID.</Text></View>;
  }

  return (
    <LinearGradient
      colors={currentTheme.gradientColors}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <Stack.Screen
          options={{
            headerTitle: () => (
              <ChatHeaderTitle
                userName={matchedUserName}
                avatarUrl={matchedUserAvatar}
                isOnline={isOtherUserOnline}
                lastSeen={otherUserLastSeen}
              />
            ),
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 10 : 0 }}>
                <Ionicons name="arrow-back" size={28} color="#EA405A" />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <TouchableOpacity
                style={{ marginRight: 15 }}
                onPress={() => {
                  if (matchIdString && matchedUserID) {
                    router.push({
                      pathname: "/(tabs)/chat/setting",
                      params: { matchId: matchIdString, matchedUserId: matchedUserID.toString() }
                    });
                  } else {
                    Alert.alert("Error", "Cannot open settings. User information is missing.");
                  }
                }}
              >
                <Ionicons name="information-circle-outline" size={28} color="#EA405A" />
              </TouchableOpacity>
            ),
            headerTitleAlign: 'left',
          }}
        />
        {otherUserTyping && (
          <View style={styles.typingIndicatorContainer}>
            <Text style={styles.typingIndicatorText}>{otherUserTyping} is typing...</Text>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(item) => item.messageID?.toString() || Math.random().toString()}
          style={styles.messageList}
          contentContainerStyle={{ paddingBottom: 10, paddingTop: 10 }}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}
        />
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={() => handlePickMedia('Images')} style={styles.mediaButton}>
            <Ionicons name="image" size={24} color="#EA405A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handlePickMedia('Videos')} style={styles.mediaButton}>
            <Ionicons name="videocam" size={24} color="#EA405A" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleTyping}
            placeholder="Type a message..."
            multiline
          />
          <TouchableOpacity onPress={() => handleSend()} style={styles.sendButton} disabled={!inputText.trim() && messages.length === 0}>
            <Ionicons name="send" size={24} color={(!inputText.trim() && messages.length === 0) ? "#BDBDBD" : "#EA405A"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 10,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 5,
    alignItems: 'flex-end',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  myMessageBubble: {
    backgroundColor: '#EA405A',
  },
  otherMessageBubble: {
    backgroundColor: '#E9E9EB',
  },
  myMessageBubbleTail: {
    borderBottomRightRadius: 5,
  },
  otherMessageBubbleTail: {
    borderBottomLeftRadius: 5,
  },
  myMessageText: {
    color: 'white',
    fontSize: 16,
  },
  otherMessageText: {
    color: 'black',
    fontSize: 16,
  },
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  mediaVideo: {
    width: 220,
    height: 180,
    borderRadius: 10,
    backgroundColor: 'black',
    marginTop: 4,
    marginBottom: 4,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  timestamp: {
    fontSize: 11,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    marginHorizontal: 8,
  },
  mediaButton: {
    padding: 8,
  },
  sendButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typingIndicatorContainer: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  typingIndicatorText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Platform.OS === 'ios' ? -10 : 0,
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
