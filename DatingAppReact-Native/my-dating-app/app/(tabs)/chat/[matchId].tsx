import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ColorValue,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
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
} from '../../../utils/api'; // Đảm bảo đường dẫn này chính xác
import { useAuth } from '../../context/AuthContext'; // Đảm bảo đường dẫn này chính xác
import { useChat } from '../../context/ChatContext';   // Đảm bảo đường dẫn này chính xác
import { ChatHubEvents } from '../../../hooks/useChatHub'; // Đảm bảo đường dẫn này chính xác
import Ionicons from '@expo/vector-icons/Ionicons';

const DEFAULT_AVATAR = 'https://via.placeholder.com/40';
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const PAGE_SIZE = 20;

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

const ChatHeaderTitle = ({ userName, avatarUrl, isOnline, lastSeen }: { userName: string; avatarUrl: string; isOnline?: boolean; lastSeen?: string | null }) => {
  const formatLastSeenHeader = (isoString: string | null | undefined): string => {
    if (!isoString) return 'Offline';
    try {
      const dateUtc = parseISO(isoString);
      const dateInVietnam = toZonedTime(dateUtc, VIETNAM_TIME_ZONE);
      const nowInVietnam = toZonedTime(new Date(), VIETNAM_TIME_ZONE);

      if (isTodayFn(dateInVietnam)) {
        return `Hoạt động hôm nay lúc ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
      }
      if (isYesterdayFn(dateInVietnam)) {
        return `Hoạt động hôm nay lúc ${formatInTimeZone(dateUtc, VIETNAM_TIME_ZONE, 'HH:mm')}`;
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
        <Text style={styles.headerUserName} numberOfLines={1}>{decodeURIComponent(userName)}</Text>
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
 const [initialScrollDone, setInitialScrollDone] = useState(false);
  const matchIdString = params.matchId;

  const matchId = parseInt(matchIdString!, 10);
  const matchedUserID = params.matchedUserID ? parseInt(params.matchedUserID, 10) : undefined;

  const [matchedUserName, setMatchedUserName] = useState(
    params.matchedUserName ? decodeURIComponent(params.matchedUserName) : 'Chat'
  );
  const [matchedUserAvatar, setMatchedUserAvatar] = useState(
    params.matchedUserAvatar ? decodeURIComponent(params.matchedUserAvatar) : DEFAULT_AVATAR
  );
  const navParamAvatar = params.matchedUserAvatar ? decodeURIComponent(params.matchedUserAvatar) : DEFAULT_AVATAR;

  const [isOtherUserOnline, setIsOtherUserOnline] = useState(params.isMatchedUserOnline === 'true');
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<string | null>(
    params.matchedUserLastSeen ? decodeURIComponent(params.matchedUserLastSeen) : null
  );
  const [currentTheme, setCurrentTheme] = useState<ThemeOption | null>(null);
  const [themeLoading, setThemeLoading] = useState(true);

  const { user } = useAuth();
  const { registerEventHandlers, unregisterEventHandlers, isConnected, sendUserStartedTyping, sendUserStoppedTyping } = useChat();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [otherUserTyping, setOtherUserTyping] = useState<string | null>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserId = user?.userId ?? -1;
  const processedMatchIdRef = useRef<number | undefined>(undefined);
  const allowFocusScrollRef = useRef(true); // Ref to control focus scroll

  if (!matchIdString) {
    if (router.canGoBack()) router.back();
    return <View style={styles.centered}><Text>Error: Chat not found.</Text></View>;
  }


  // Effect for loading theme - depends primarily on matchIdString
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
          // Handle cases where matchIdString might be initially undefined
          setCurrentTheme(localDefaultThemes[0]);
          setThemeLoading(false);
        }
      };
      loadTheme();
    }, [matchIdString]) // Only re-run if matchIdString changes
  );

  // Effect for scrolling to bottom on focus (e.g., navigating back)
  useFocusEffect(
    useCallback(() => {
      let scrollTimer: NodeJS.Timeout | null = null;
      // Conditions for scrolling:
      // - FlatList ref is available.
      // - There are messages.
      // - Initial loading is complete.
      // - Not currently loading more messages (to avoid conflict with pagination scroll).
      // - Initial scroll (by useLayoutEffect) has been performed.
      // - Scrolling on focus is allowed (not immediately after pagination)
      if (flatListRef.current && messages.length > 0 && !isLoadingInitial && !isLoadingMore && initialScrollDone && allowFocusScrollRef.current) {
        scrollTimer = setTimeout(() => {
          // Double-check isLoadingMore and allowFocusScrollRef in case they changed during the timeout
          if (flatListRef.current && !isLoadingMore && allowFocusScrollRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false });
          }
        }, 150); // Delay to allow layout to settle
      }
      return () => {
        if (scrollTimer) clearTimeout(scrollTimer);
      };
    }, [initialScrollDone, isLoadingInitial]) // Adjusted dependencies for scroll-on-focus logic
  );

  const fetchMessages = useCallback(async (pageToFetch = 1, isInitialLoad = false) => {
    if (isNaN(matchId) || (isLoadingMore && !isInitialLoad) || (!hasMoreMessages && !isInitialLoad)) {
      return;
    }

    if (isInitialLoad) {
      setIsLoadingInitial(true);
    } else {
      allowFocusScrollRef.current = false; // Disable focus scroll during pagination
      setIsLoadingMore(true);
    }

    try {
      const newMessagesFetched = await getMessagesForMatch(matchId, pageToFetch, PAGE_SIZE);

      if (newMessagesFetched.length < PAGE_SIZE) {
        setHasMoreMessages(false);
      }

      if (newMessagesFetched.length > 0) {
        setMessages(prevMessages => {
          let updatedMessages;
          const allMessagesToProcess = isInitialLoad ? newMessagesFetched : [...newMessagesFetched, ...prevMessages];
          
          const uniqueMessages: MessageDTO[] = [];
          const encounteredKeys = new Set<string>();
          let tempKeyIndex = 0; // For generating unique keys for items missing messageID during de-duplication

          for (const item of allMessagesToProcess) {
            let key: string;
            if (item && item.messageID != null) {
              key = `msg-${item.messageID.toString()}-${item.timestamp}`;
            } else {
              // This fallback key generation is for the de-duplication logic's Set.
              // The actual FlatList keyExtractor will use its own index.
              const itemTs = item && item.timestamp ? item.timestamp : '';
              key = `temp-dedup-idx-${tempKeyIndex++}-${itemTs}`;
              if (!item || item.messageID == null) {
                console.warn(`ChatScreen Deduplication: Item missing messageID. Generated de-dup key: ${key}`, item);
              }
            }

            if (!encounteredKeys.has(key)) {
              // Ensure item is not null before pushing, though MessageDTO[] should prevent this.
              if (item) { 
                uniqueMessages.push(item);
                encounteredKeys.add(key);
              }
            }
          }
          
          // Sort messages descending (newest first) for standard chat with inverted FlatList
          return uniqueMessages.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
        });
      }
       if(newMessagesFetched.length > 0 || !hasMoreMessages || pageToFetch === 1) { // This condition for setCurrentPage seems fine
        setCurrentPage(pageToFetch);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      if (isInitialLoad) {
        setIsLoadingInitial(false);
      } else {
        setIsLoadingMore(false);
        // Re-enable focus scroll shortly after pagination is done
        setTimeout(() => {
          allowFocusScrollRef.current = true;
        }, 200); 
      }
    }
  }, [matchId, hasMoreMessages, isLoadingMore]);


  useEffect(() => {
    // matchId is the parsed numeric ID from component scope
    if (!isNaN(matchId)) {
      // Only reset and fetch if this specific matchId hasn't been processed yet,
      // or if it's a genuinely new, valid matchId.
      if (processedMatchIdRef.current !== matchId) {
        setMessages([]);
        setCurrentPage(1);
        setHasMoreMessages(true);
        setIsLoadingInitial(true);
        fetchMessages(1, true); // fetchMessages uses `matchId` from its useCallback dependency
        markMessagesAsRead(matchId).catch(console.error);
        processedMatchIdRef.current = matchId;
      }
    }
    // If matchId is NaN, we don't reset processedMatchIdRef.current here.
    // This allows the check `processedMatchIdRef.current !== matchId` to correctly
    // prevent a reload if matchId flickers from a number to NaN and back to the same number.
  }, [matchId, fetchMessages]); // fetchMessages is a useCallback depending on matchId

  // Cuộn xuống tin nhắn mới nhất sau khi tải lần đầu
  useLayoutEffect(() => {
    // Chỉ cuộn nếu:
    // 1. Không phải đang tải lần đầu
    // 2. Có tin nhắn
    // 3. flatList đã được ref
    // 4. Việc cuộn lần đầu CHƯA được thực hiện
    if (!isLoadingInitial && messages.length > 0 && flatListRef.current && !initialScrollDone) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        setInitialScrollDone(true); // Đánh dấu đã cuộn lần đầu
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingInitial, messages.length, initialScrollDone]);
  
  useEffect(() => {
    if (!isConnected || !user || currentUserId === -1 || isNaN(matchId)) return;

    const handlers: ChatHubEvents = {
      onReceiveMessage: (newMessage: MessageDTO) => {
        if (newMessage.matchID === matchId) {
          setMessages(prevMessages => {
            if (newMessage.senderUserID === currentUserId) {
              const existingMsgIndex = prevMessages.findIndex(
                msg => msg.messageID === newMessage.messageID && newMessage.messageID > 0
              );

              if (existingMsgIndex !== -1) {
                const updatedMessages = [...prevMessages];
                updatedMessages[existingMsgIndex] = {
                  ...prevMessages[existingMsgIndex], 
                  ...newMessage,                 
                  isMe: true                        
                };
                return updatedMessages.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
              } else {
                return prevMessages;
              }
            } else {
              const messageExists = prevMessages.some(
                msg => msg.messageID === newMessage.messageID && newMessage.messageID > 0
              );
              if (messageExists) {
                return prevMessages; // Already exists, do nothing
              }
              // Add the new message from the other user and sort descending
              return [...prevMessages, { ...newMessage, isMe: false }].sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
            }
          });

          // Mark messages as read only if they are from the other user and this chat is active.
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
    const decodedUserName = params.matchedUserName ? decodeURIComponent(params.matchedUserName) : 'Chat';
    const decodedUserAvatar = params.matchedUserAvatar ? decodeURIComponent(params.matchedUserAvatar) : DEFAULT_AVATAR;
    const decodedLastSeen = params.matchedUserLastSeen ? decodeURIComponent(params.matchedUserLastSeen) : null;

    setMatchedUserName(decodedUserName);
    setMatchedUserAvatar(decodedUserAvatar);
    if (params.isMatchedUserOnline !== undefined) {
      setIsOtherUserOnline(params.isMatchedUserOnline === 'true');
    }
    if (params.matchedUserLastSeen !== undefined) {
      setOtherUserLastSeen(decodedLastSeen);
    }
  }, [params.matchedUserName, params.matchedUserAvatar, params.isMatchedUserOnline, params.matchedUserLastSeen]);

  const handleSend = async (type: MessageTypeEnum = MessageTypeEnum.Text, mediaUrlToSend?: string, contentInput?: string) => {
    if (isNaN(matchId) || currentUserId === -1) return;
    const messageContent = contentInput || inputText;
    if (!messageContent.trim() && !mediaUrlToSend) return;

    const tempId = -Date.now();
    const optimisticMessage: MessageDTO = {
      messageID: tempId,
      matchID: matchId,
      senderUserID: currentUserId,
      senderFullName: user?.fullName || user?.username || 'Me',
      senderAvatar: user?.avatar || DEFAULT_AVATAR,
      receiverUserID: matchedUserID || 0,
      content: messageContent,
      timestamp: new Date().toISOString(),
      isRead: false,
      isMe: true,
      type: mediaUrlToSend ? type : MessageTypeEnum.Text,
      mediaUrl: mediaUrlToSend ? (mediaUrlToSend.startsWith('http') ? mediaUrlToSend : `${API_BASE_URL}${mediaUrlToSend}`) : undefined,
    };

    // Add optimistic message and sort descending
    setMessages(prev => [...prev, optimisticMessage].sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()));
    setInputText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      sendUserStoppedTyping(matchId, currentUserId);
      typingTimeoutRef.current = null;
    }

    try {
      const dto: SendMessageDTO = {
        matchID: matchId,
        content: messageContent,
        type: mediaUrlToSend ? type : MessageTypeEnum.Text,
        mediaUrl: mediaUrlToSend,
      };
      const sentMessage = await sendMessage(dto);
      // Update optimistic message with server response and sort descending
      setMessages(prev => prev.map(msg => msg.messageID === tempId ? { ...sentMessage, isMe: true } : msg)
                               .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()));
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert("Error", "Could not send message.");
      setMessages(prev => prev.filter(msg => msg.messageID !== tempId));
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
    if (isMyMessage) {
      senderAvatarDisplayUrl = user?.avatar && user.avatar.startsWith('http') ? user.avatar : (user?.avatar ? `${API_BASE_URL}${user.avatar}` : DEFAULT_AVATAR);
    } else if (item.senderAvatar) {
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

    const finalMediaUrl = item.mediaUrl
      ? (item.mediaUrl.startsWith('http') ? item.mediaUrl : `${API_BASE_URL}${item.mediaUrl}`)
      : undefined;

    return (
      <View style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}>
        {!isMyMessage && (
          <TouchableOpacity onPress={() => router.push(`/(tabs)/chat/user-profile/${item.senderUserID}`)}>
            <Image source={{ uri: senderAvatarDisplayUrl }} style={styles.avatar} />
          </TouchableOpacity>
        )}
        <View style={[
          styles.messageBubble,
          isMyMessage
            ? { backgroundColor: currentTheme?.myMessageBubbleColor || styles.myMessageBubble.backgroundColor }
            : { backgroundColor: currentTheme?.otherMessageBubbleColor || styles.otherMessageBubble.backgroundColor },
          isMyMessage ? styles.myMessageBubbleTail : styles.otherMessageBubbleTail
        ]}>
          {item.type === MessageTypeEnum.Image && finalMediaUrl && (
            <Image source={{ uri: finalMediaUrl }} style={styles.mediaImage} resizeMode="contain" />
          )}
          {item.type === MessageTypeEnum.Video && finalMediaUrl && (
            <Video
              source={{ uri: finalMediaUrl }}
              style={styles.mediaVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
            />
          )}
          {item.content && item.content.trim() !== "" && !shouldHideDefaultCaption && (item.type === MessageTypeEnum.Text || item.mediaUrl) && (
            <Text style={[
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
              { color: isMyMessage ? (currentTheme?.id === 'default' ? '#FFFFFF' : currentTheme?.textColor) : currentTheme?.textColor }
            ]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageInfo}>
            <Text style={[styles.timestamp, { color: isMyMessage ? (currentTheme?.id === 'default' ? 'rgba(255,255,255,0.7)' : `${currentTheme?.textColor}99`) : (currentTheme?.textColor ? `${currentTheme.textColor}99` : 'rgba(0,0,0,0.4)') }]}>
              {formatInTimeZone(dateObject, VIETNAM_TIME_ZONE, 'p')}
            </Text>
            {isMyMessage && item.messageID > 0 && item.isRead && <Ionicons name="checkmark-done" size={14} color="#4FC3F7" style={{ marginLeft: 5 }} />}
            {isMyMessage && item.messageID > 0 && !item.isRead && <Ionicons name="checkmark" size={14} color={isMyMessage ? (currentTheme?.id === 'default' ? 'rgba(255,255,255,0.7)' : `${currentTheme?.textColor}99` ) : "grey"} style={{ marginLeft: 5 }} />}
            {isMyMessage && item.messageID < 0 && <Ionicons name="time-outline" size={14} color={isMyMessage ? (currentTheme?.id === 'default' ? 'rgba(255,255,255,0.7)' : `${currentTheme?.textColor}99` ) : "grey"} style={{ marginLeft: 5 }} />}
          </View>
        </View>
      </View>
    );
  };

  const loadMoreMessages = () => {
    if (!isLoadingMore && !isLoadingInitial && hasMoreMessages && !isNaN(matchId)) {
      fetchMessages(currentPage + 1, false);
    }
  };

  if (themeLoading || (isLoadingInitial && messages.length === 0 && currentPage === 1)) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#EB3C58" /></View>;
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
        keyboardVerticalOffset={Platform.OS === "ios" ? (Number(Platform.Version) < 14 ? 60 : 90) : 0}
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
              <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 10 : 0, paddingHorizontal: 5 }}>
                <Ionicons name="arrow-back" size={28} color="#EA405A" />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <TouchableOpacity
                style={{ marginRight: 15 }}
                onPress={() => {
                  if (matchIdString && matchedUserID) {
                    router.push({
                      pathname: '/(tabs)/chat/setting' as any, // Corrected path to singular 'setting' and removed dynamic segment
                      params: { matchedUserId: matchedUserID?.toString(), matchId: matchIdString } // Pass both params if needed by setting screen
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
            headerBackTitle: ' ', // Re-add to hide "Back" text on iOS
          }}
        />
        {otherUserTyping && (
          <View style={styles.typingIndicatorContainer}>
            <Text style={styles.typingIndicatorText}>{otherUserTyping} đang nhập...</Text>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          renderItem={renderMessageItem}
          keyExtractor={(item, index) => {
            if (item && item.messageID != null) { // Check for null or undefined
              return `msg-${item.messageID.toString()}-${item.timestamp}`; // Added timestamp for more uniqueness
            }
            // Fallback for items with missing messageID
            console.warn(`ChatScreen: Message item at index ${index} is missing messageID. Using index as part of key. Item:`, item);
            return `temp-idx-${index}-${item.timestamp || ''}`; // Also add timestamp to fallback if available
          }}
          style={styles.messageList}
          contentContainerStyle={{ paddingVertical: 10 }}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.6} 
          ListFooterComponent={isLoadingMore ? <ActivityIndicator color="#EB3C58" /> : null} 
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
          initialNumToRender={PAGE_SIZE}
          maxToRenderPerBatch={PAGE_SIZE}
          windowSize={11}
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
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity 
            onPress={() => handleSend()} 
            style={styles.sendButton} 
            disabled={!inputText.trim() && (isLoadingInitial || messages.some(m => m.messageID < 0))}
          >
            <Ionicons 
              name="send" 
              size={24} 
              color={(!inputText.trim() && (isLoadingInitial || messages.some(m => m.messageID < 0))) ? "#BDBDBD" : "#EA405A"} 
            />
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
    fontSize: 16,
  },
  otherMessageText: {
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
    borderTopWidth: StyleSheet.hairlineWidth,
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
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    maxWidth: Platform.OS === 'ios' ? '70%' : '80%',
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
