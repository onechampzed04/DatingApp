import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Alert,
  Modal, FlatList, ActivityIndicator, Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import VideoPlayer from 'expo-video-player';
import { ResizeMode } from 'expo-av';

import {
  Post, PostUser, ReactionType, API_BASE_URL, addOrUpdateReactionToPost, ReactionSummaryResponse,
  getPostReactions, PostReaction
} from '../../utils/api';
import { useAuth } from '../../app/context/AuthContext';
import { formatDistanceToNowStrict } from 'date-fns';

const { width: screenWidth } = Dimensions.get('window');
const FALLBACK_AVATAR = require('../../assets/images/dating-app.png');
const POST_IMAGE_HEIGHT = screenWidth * 0.8;

export const REACTIONS = [
  { type: ReactionType.Like, name: 'Like', icon: 'heart', color: '#EB3C58', emoji: '❤️' },
  { type: ReactionType.Love, name: 'Love', icon: 'heart-circle-outline', color: '#F7B731', emoji: '😍' },
  { type: ReactionType.Haha, name: 'Haha', icon: 'happy-outline', color: '#45B8AC', emoji: '😂' },
  { type: ReactionType.Wow, name: 'Wow', icon: 'star-outline', color: '#9B59B6', emoji: '😮' },
  { type: ReactionType.Sad, name: 'Sad', icon: 'sad-outline', color: '#3498DB', emoji: '😢' },
  { type: ReactionType.Angry, name: 'Angry', icon: 'flame-outline', color: '#E74C3C', emoji: '😠' },
];

const getReactionDetails = (reactionType: ReactionType | null) => {
  if (reactionType === null) {
    return { name: 'Like', icon: 'heart-outline', color: '#555', emoji: '👍' };
  }
  return REACTIONS.find(r => r.type === reactionType) || REACTIONS.find(r => r.type === ReactionType.Like)!;
};

interface PostCardProps {
  post: Post;
  onCommentPress?: (postId: number) => void;
  onSharePress?: (postId: number) => void;
  onUpdatePost?: (updatedPost: Post) => void;
  isDetailView?: boolean;
}

const PostCard: React.FC<PostCardProps> = ({ post, onCommentPress, onSharePress, onUpdatePost, isDetailView = false }) => {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(post.currentUserReaction ?? null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(post.reactionCounts || {});
  const [totalReactions, setTotalReactions] = useState(post.totalReactions || 0);
  const [isReacting, setIsReacting] = useState(false);

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactorsListVisible, setReactorsListVisible] = useState(false);
  const [reactors, setReactors] = useState<PostReaction[]>([]);
  const [isLoadingReactors, setIsLoadingReactors] = useState(false);
  const [selectedReactionTypeForFilter, setSelectedReactionTypeForFilter] = useState<ReactionType | null>(null);
  const [summaryReactors, setSummaryReactors] = useState<PostReaction[]>([]);

  const postUser = post.user;

  const userAvatarUrl = useMemo(() => {
    if (postUser?.avatar) {
      return postUser.avatar.startsWith('http') ? postUser.avatar : `${API_BASE_URL}${postUser.avatar}`;
    }
    return null;
  }, [postUser?.avatar]);

  const mediaUrl = useMemo(() => {
    const url = post.imageUrl || post.videoUrl;
    if (url) {
      return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    }
    return null;
  }, [post.imageUrl, post.videoUrl]);

  const timeAgo = useMemo(() => {
    try {
      if (post.createdAt) { // Thêm kiểm tra post.createdAt có tồn tại không
        return formatDistanceToNowStrict(new Date(post.createdAt), { addSuffix: true });
      }
      return "a while ago"; // Giá trị mặc định nếu createdAt không có
    } catch (e) {
      console.error("Error formatting timeAgo for post:", post.postID, e);
      return "a while ago";
    }
  }, [post.createdAt, post.postID]); // Thêm post.postID vào dependency để debug dễ hơn nếu cần


  const handleReaction = async (reactionType: ReactionType) => {
    if (!currentUser || isReacting || !post?.postID) return; // Thêm kiểm tra post.postID
    setIsReacting(true);
    setShowReactionPicker(false);

    const oldReaction = currentReaction;
    const oldTotalReactions = totalReactions;
    const oldReactionCounts = { ...reactionCounts };

    let newReactionCounts = { ...reactionCounts };
    let newTotalReactions = totalReactions;
    const reactionTypeStr = reactionType.toString();

    if (currentReaction === reactionType) {
      setCurrentReaction(null);
      newTotalReactions = Math.max(0, totalReactions - 1);
      if (newReactionCounts.hasOwnProperty(reactionTypeStr)) {
        newReactionCounts[reactionTypeStr] = Math.max(0, (newReactionCounts[reactionTypeStr]!) - 1);
      }
    } else {
      if (currentReaction !== null) {
        const currentReactionStr = currentReaction.toString();
        if (newReactionCounts.hasOwnProperty(currentReactionStr)) {
          newReactionCounts[currentReactionStr] = Math.max(0, (newReactionCounts[currentReactionStr]!) - 1);
        }
      } else if (currentReaction === null) {
        newTotalReactions = totalReactions + 1;
      }
      setCurrentReaction(reactionType);
      newReactionCounts[reactionTypeStr] = (newReactionCounts[reactionTypeStr] || 0) + 1;
    }
    setReactionCounts(newReactionCounts);
    setTotalReactions(newTotalReactions);

    try {
      const summary: ReactionSummaryResponse = await addOrUpdateReactionToPost(post.postID, { reactionType });
      setCurrentReaction(summary.currentUserReaction ?? null);
      setReactionCounts(summary.reactionCounts || {});
      setTotalReactions(summary.totalReactions || 0);

      if (onUpdatePost) {
          onUpdatePost({
              ...post,
              currentUserReaction: summary.currentUserReaction,
              reactionCounts: summary.reactionCounts || {},
              totalReactions: summary.totalReactions || 0,
          });
      }
      if (summary.totalReactions > 0) {
        const updatedSummaryReactors = await getPostReactions(post.postID);
        const uniqueUserReactions = Array.from(new Map(updatedSummaryReactors.map(r => [r.user.userID, r])).values());
        setSummaryReactors(uniqueUserReactions.slice(0, 3));
      } else {
        setSummaryReactors([]);
      }

    } catch (error) {
      console.error("Failed to react to post:", post.postID, error);
      setCurrentReaction(oldReaction);
      setReactionCounts(oldReactionCounts);
      setTotalReactions(oldTotalReactions);
    } finally {
      setIsReacting(false);
    }
  };

  const navigateToUserProfile = (userId: number) => {
    if (currentUser?.userId === userId) {
      router.push('/(tabs)/profile');
    } else {
      router.push({ pathname: `../user-profile/${userId}` });
    }
  };

  const navigateToPostDetail = () => {
    if (!isDetailView && post?.postID) { // Thêm kiểm tra post.postID
      router.push({
        pathname: '../(tabs)/post-detail/[postId]',
        params: { postId: post.postID.toString() },
      });
    }
  };

  const handleMainReactionButtonPress = () => {
    if (showReactionPicker) {
      setShowReactionPicker(false);
      return;
    }
    if (currentReaction !== null) {
      handleReaction(currentReaction);
    } else {
      handleReaction(ReactionType.Like);
    }
  };

  const handleMainReactionButtonLongPress = () => {
    if (isReacting) return;
    setShowReactionPicker(true);
  };

  const fetchReactors = async (type: ReactionType | null = null) => {
    if (!post?.postID) return; // Thêm kiểm tra post.postID
    setIsLoadingReactors(true);
    try {
      const fetchedReactors = await getPostReactions(post.postID, type ?? undefined);
      setReactors(fetchedReactors);
    } catch (error) {
      console.error("Failed to fetch reactors for post:", post.postID, error);
      Alert.alert("Error", "Could not load reactions.");
    } finally {
      setIsLoadingReactors(false);
    }
  };

  const handleOpenReactorsList = () => {
    if (!post?.postID) return; // Thêm kiểm tra
    setSelectedReactionTypeForFilter(null);
    fetchReactors();
    setReactorsListVisible(true);
  };

  const handleFilterReactorsByType = (type: ReactionType | null) => {
    if (!post?.postID) return; // Thêm kiểm tra
    setSelectedReactionTypeForFilter(type);
    fetchReactors(type);
  };

  const reactionDetails = getReactionDetails(currentReaction);

  useEffect(() => {
    const fetchInitialReactorsForSummary = async () => {
      // Đảm bảo post và post.postID tồn tại trước khi fetch
      if (post && post.postID && totalReactions > 0 && summaryReactors.length === 0) {
        try {
          const fetchedReactors = await getPostReactions(post.postID);
          const uniqueUserReactions = Array.from(new Map(fetchedReactors.map(r => [r.user.userID, r])).values());
          setSummaryReactors(uniqueUserReactions.slice(0, 3));
        } catch (error) {
          console.error("Failed to fetch summary reactors for post:", post.postID, error);
        }
      } else if (totalReactions === 0) {
        setSummaryReactors([]);
      }
    };

    fetchInitialReactorsForSummary();
  }, [post, totalReactions]); // Thay post.postID bằng post để useEffect chạy khi post prop thay đổi hoàn toàn


  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity onPress={() => postUser && navigateToUserProfile(postUser.userID)} style={styles.header}>
        <Image source={userAvatarUrl ? { uri: userAvatarUrl } : FALLBACK_AVATAR} style={styles.avatar} />
        <View style={styles.headerTextContainer}>
          <Text style={styles.username}>{postUser?.fullName || postUser?.username || "User"}</Text>
          <Text style={styles.timestamp}>{timeAgo}</Text>
        </View>
      </TouchableOpacity>

      {/* Content */}
      {post.content && (
        <TouchableOpacity onPress={navigateToPostDetail} activeOpacity={isDetailView ? 1 : 0.7}>
          <Text style={styles.content}>{post.content}</Text>
        </TouchableOpacity>
      )}

      {/* Media */}
      {mediaUrl && (
        <TouchableOpacity onPress={navigateToPostDetail} activeOpacity={isDetailView ? 1 : 0.7}>
          {post.imageUrl && <Image source={{ uri: mediaUrl }} style={styles.postImage} resizeMode="cover" />}
          {post.videoUrl && (
            <VideoPlayer
              videoProps={{
                shouldPlay: false,
                resizeMode: ResizeMode.COVER,
                source: { uri: mediaUrl },
              }}
              style={{ height: POST_IMAGE_HEIGHT, width: screenWidth, videoBackgroundColor: '#000' }}
            />
          )}
        </TouchableOpacity>
      )}

       {/* Stats */}
      <View style={styles.statsContainer}>
        <TouchableOpacity onPress={handleOpenReactorsList} style={styles.reactionSummaryTouchable}>
            <View style={styles.reactionSummaryContainer}>
          {totalReactions > 0 && (
              <View style={styles.reactionEmojiDisplayContainer}>
                  {Object.entries(reactionCounts)
                      // ... (filter, sort, slice) ...
                      .map(([reactionName, count]) => { // Đổi tên biến: reactionName là "Sad", "Haha", ...
    // Tìm reaction detail dựa trên TÊN reaction
    const rDetail = REACTIONS.find(r => r.name === reactionName);
    
    // Thêm log để kiểm tra
    console.log(`[PostCard ID: ${post?.postID}] EmojiSummary: name=${reactionName}, count=${count}, rDetail=`, rDetail);

    return rDetail ? (
        <Text key={rDetail.type} style={styles.reactionEmojiItem}> 
            {/* Vẫn dùng rDetail.type (là số enum) làm key cho React vì nó unique */}
            {rDetail.emoji}
        </Text>
    ) : null;
})}
              </View>
          )}
          <Text style={styles.statsText}>
              {totalReactions > 0 ? ` ${totalReactions}` : 'No Reactions'}
          </Text>
      </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onCommentPress && post?.postID && onCommentPress(post.postID)}>
            <Text style={styles.statsText}>{post.totalComments || 0} Comments</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, currentReaction !== null && styles.actionButtonActive]}
          onPress={handleMainReactionButtonPress}
          onLongPress={handleMainReactionButtonLongPress}
          delayLongPress={300}
          disabled={isReacting}
        >
          <Ionicons name={reactionDetails.icon as any} size={24} color={reactionDetails.color} />
          <Text style={[styles.actionText, { color: reactionDetails.color }]}>{reactionDetails.name}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onCommentPress && post?.postID && onCommentPress(post.postID)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#555" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        {showReactionPicker && (
          <View style={styles.reactionPickerOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setShowReactionPicker(false)}
              activeOpacity={1}
            />
            <View style={styles.reactionPickerContainer}>
              {REACTIONS.map((reaction) => (
                <TouchableOpacity
                  key={reaction.type}
                  onPress={() => handleReaction(reaction.type)}
                  style={styles.reactionEmojiButton}
                >
                  <Text style={styles.reactionEmojiText}>{reaction.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {post && ( // Kiểm tra post tồn tại trước khi render Modal
        <Modal
          animationType="slide"
          transparent={false}
          visible={reactorsListVisible}
          onRequestClose={() => setReactorsListVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reactions</Text>
              <TouchableOpacity onPress={() => setReactorsListVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.reactionFilterScroll}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionFilterContainer}>
                <TouchableOpacity
                  style={[styles.filterTab, selectedReactionTypeForFilter === null && styles.filterTabActive]}
                  onPress={() => handleFilterReactorsByType(null)}
                >
                  <Text style={[styles.filterTabText, selectedReactionTypeForFilter === null && styles.filterTabTextActive]}>All ({totalReactions})</Text>
                </TouchableOpacity>
                {Object.entries(reactionCounts)
                  .filter(([, count]) => count > 0)
                  .sort((a, b) => {
                    const typeA = parseInt(a[0]);
                    const typeB = parseInt(b[0]);
                    return REACTIONS.findIndex(r => r.type === typeA) - REACTIONS.findIndex(r => r.type === typeB);
                  })
                  .map(([typeKey_str, count]) => {
                    const rType = parseInt(typeKey_str) as ReactionType;
                    const rDetail = REACTIONS.find(r => r.type === rType);
                    return rDetail ? (
                      <TouchableOpacity
                        key={rType}
                        style={[styles.filterTab, selectedReactionTypeForFilter === rType && styles.filterTabActive]}
                        onPress={() => handleFilterReactorsByType(rType)}
                      >
                        <Text style={[styles.filterTabText, selectedReactionTypeForFilter === rType && styles.filterTabTextActive]}>
                          {rDetail.emoji} {String(count)}
                        </Text>
                      </TouchableOpacity>
                    ) : null;
                  })}
              </ScrollView>
            </View>

            {isLoadingReactors ? (
              <ActivityIndicator size="large" color="#EB3C58" style={{ marginTop: 20, flex: 1 }} />
            ) : (
              <FlatList
                data={reactors} // reactors là PostReaction[]
                keyExtractor={(item) => item.postReactionID.toString()}
                renderItem={({ item }) => {
                  // item là PostReaction, và item.user là một PostUser object
                  const reactionDetail = REACTIONS.find(r => r.type === item.reactionType);
                  
                  const reactorUser = item.user; // Object PostUser
                  // Kiểm tra reactorUser trước khi truy cập thuộc tính
                  if (!reactorUser) return null;

                  const reactorAvatarUrl = reactorUser.avatar
                      ? (reactorUser.avatar.startsWith('http') ? reactorUser.avatar : `${API_BASE_URL}${reactorUser.avatar}`)
                      : null;
                  const reactorDisplayName = reactorUser.fullName || reactorUser.username || 'User';

                  return (
                      <TouchableOpacity
                          style={styles.reactorItem}
                          // SỬA Ở ĐÂY: Truy cập qua item.user.userID
                          onPress={() => navigateToUserProfile(reactorUser.userID)}
                      >
                          <Image 
                              source={reactorAvatarUrl ? { uri: reactorAvatarUrl } : FALLBACK_AVATAR} 
                              style={styles.reactorAvatar} 
                          />
                          {/* SỬA Ở ĐÂY: Hiển thị reactorDisplayName */}
                          <Text style={styles.reactorName}>{reactorDisplayName}</Text>
                          {reactionDetail && <Text style={styles.reactorEmoji}>{reactionDetail.emoji}</Text>}
                      </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<View style={styles.emptyReactorsContainer}><Text style={styles.emptyReactorsText}>No reactions of this type yet.</Text></View>}
                contentContainerStyle={{ flexGrow: 1 }}
              />
            )}
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  summaryAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  summaryAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#eee',
  },
  statsTextWithAvatars: {
    marginLeft: 4,
  },

  // Đảm bảo các style này không bị conflic hoặc được định nghĩa đúng
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
    paddingBottom: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#eee'
  },
  headerTextContainer: {
    flex: 1,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  timestamp: {
    fontSize: 12,
    color: '#777',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#333'
  },
  postImage: {
    width: '100%',
    height: POST_IMAGE_HEIGHT,
  },
   statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reactionSummaryTouchable: {
    flexShrink: 1,
  },
  reactionSummaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // reactionIconsContainer và reactionIconSummary có thể không cần nếu chỉ hiển thị avatar ở summary
   reactionIconsContainer: { // Container cho các icon reaction
    flexDirection: 'row',
    alignItems: 'center', // Để các icon được căn giữa theo chiều dọc nếu kích thước khác nhau
    marginRight: 6,
  },
   reactionIconSummary: {
     fontSize: 15,
     marginRight: -3,
   },
  statsText: {
    fontSize: 13,
    color: '#555',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 0,
    position: 'relative',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  actionButtonActive: {},
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  reactionPickerOverlay: {
    position: 'absolute',
    bottom: 45,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  reactionPickerContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
    borderColor: Platform.OS === 'ios' ? '#ddd' : 'transparent',
  },
  reactionEmojiButton: {
    padding: 6,
    transform: [{ scale: 1 }],
  },
  reactionEmojiText: {
    fontSize: 28,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  reactionFilterScroll: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reactionFilterContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f2f5',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterTabActive: {
    backgroundColor: '#E0E7FF',
  },
  filterTabText: {
    color: '#333',
    fontSize: 14,
  },
  filterTabTextActive: {
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  reactorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  reactorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  reactorName: {
    fontSize: 15,
    flex: 1,
    color: '#333',
    fontWeight: '500',
  },
  reactorEmoji: {
    fontSize: 20,
    marginLeft: 10,
  },
  emptyReactorsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyReactorsText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
  reactionIconWrapper: { // Wrapper cho mỗi icon để tạo nền tròn và màu
    width: 18,          // Kích thước của vòng tròn nền
    height: 18,
    borderRadius: 9,    // Nửa width/height để tạo hình tròn
    justifyContent: 'center',
    alignItems: 'center',
    // Để các icon chồng nhẹ lên nhau hoặc có khoảng cách
    // marginRight: -5, // Ví dụ nếu muốn chồng lên
    marginRight: 3,  // Khoảng cách nhỏ giữa các icon
    // Thêm viền nếu muốn
    // borderWidth: 1,
    // borderColor: '#fff', // Viền trắng để tách biệt nếu chồng lên nhau
  },
  reactionEmojiDisplayContainer: { // Container cho các emoji
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 5, // Khoảng cách giữa nhóm emoji và số lượng text
  },
  reactionEmojiItem: { // Style cho từng emoji text
    fontSize: 16,     // Kích thước emoji, bạn có thể điều chỉnh
    // Để các emoji chồng nhẹ lên nhau một chút (tùy chọn thẩm mỹ)
    // marginRight: -4, // Âm nếu muốn chồng lên nhau
    // Hoặc có khoảng cách nhỏ:
    marginRight: 1,
  },
});

export default PostCard;
