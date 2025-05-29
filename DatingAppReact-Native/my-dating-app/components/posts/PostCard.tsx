import React, { useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import VideoPlayer from 'expo-video-player';
import { ResizeMode } from 'expo-av';

import { Post, PostUser, ReactionType, API_BASE_URL, addOrUpdateReactionToPost, ReactionSummaryResponse } from '../../utils/api'; // Điều chỉnh đường dẫn
import { useAuth } from '../../app/context/AuthContext'; // Điều chỉnh đường dẫn
import { formatDistanceToNowStrict } from 'date-fns';

const { width: screenWidth } = Dimensions.get('window'); // Đổi tên biến
const FALLBACK_AVATAR = require('../../assets/images/dating-app.png');
const POST_IMAGE_HEIGHT = screenWidth * 0.8;

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
  const [reactionCounts, setReactionCounts] = useState(post.reactionCounts || {});
  const [totalReactions, setTotalReactions] = useState(post.totalReactions || 0);
  const [isReacting, setIsReacting] = useState(false);

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
      return formatDistanceToNowStrict(new Date(post.createdAt), { addSuffix: true });
    } catch (e) {
      return "a while ago";
    }
  }, [post.createdAt]);

  const handleReaction = async (reactionType: ReactionType) => {
    if (!currentUser || isReacting) return;
    setIsReacting(true);

    const oldReaction = currentReaction;
    const oldTotalReactions = totalReactions;
    const oldReactionCounts = { ...reactionCounts };

    let newReactionCounts = { ...reactionCounts };
    let newTotalReactions = totalReactions;

    if (currentReaction === reactionType) {
      setCurrentReaction(null);
      newTotalReactions = Math.max(0, totalReactions - 1);
      if (newReactionCounts.hasOwnProperty(reactionType)) {
        newReactionCounts[reactionType] = Math.max(0, (newReactionCounts[reactionType]!) - 1);
      }
    } else {
      if (currentReaction !== null && newReactionCounts.hasOwnProperty(currentReaction)) {
        newReactionCounts[currentReaction] = Math.max(0, (newReactionCounts[currentReaction]!) - 1);
      } else if (currentReaction === null) {
        newTotalReactions = totalReactions + 1;
      }
      setCurrentReaction(reactionType);
      newReactionCounts[reactionType] = (newReactionCounts[reactionType] || 0) + 1;
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
    } catch (error) {
      console.error("Failed to react to post:", error);
      Alert.alert("Error", "Could not process your reaction.");
      setCurrentReaction(oldReaction);
      setReactionCounts(oldReactionCounts);
      setTotalReactions(oldTotalReactions);
    } finally {
      setIsReacting(false);
    }
  };
  
  const navigateToUserProfile = (userId: number) => {
    console.log("Navigate to user profile:", userId);

    if (currentUser?.userId === userId) {
      // If it's the current user, go to their tabbed profile
      router.push('/(tabs)/profile');
    } else {
      // Otherwise, go to the generic user profile screen
      router.push({ pathname: `../user-profile/${userId}` });
    }
  };


  const navigateToPostDetail = () => {
    if (!isDetailView) {
        router.push({
            pathname: '../(tabs)/post-detail/[postId]', // Kiểm tra lại đường dẫn này
            params: { postId: post.postID.toString() },
        });
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity onPress={() => navigateToUserProfile(postUser.userID)} style={styles.header}>
        <Image source={userAvatarUrl ? { uri: userAvatarUrl } : FALLBACK_AVATAR} style={styles.avatar} />
        <View style={styles.headerTextContainer}>
          <Text style={styles.username}>{postUser.fullName || postUser.username}</Text>
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
                // useNativeControls: true,
                }}
                style={{ 
                    height: POST_IMAGE_HEIGHT, 
                    width: screenWidth, // SỬA Ở ĐÂY
                    videoBackgroundColor: '#000' 
                }}
            />
            )}
        </TouchableOpacity>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>{totalReactions || 0} Reactions</Text>
        <TouchableOpacity onPress={() => onCommentPress && onCommentPress(post.postID)}>
            <Text style={styles.statsText}>{post.totalComments || 0} Comments</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, currentReaction === ReactionType.Like && styles.actionButtonActive]}
          onPress={() => handleReaction(ReactionType.Like)}
          disabled={isReacting}
        >
          <Ionicons name={currentReaction === ReactionType.Like ? "heart" : "heart-outline"} size={24} color={currentReaction === ReactionType.Like ? "#EB3C58" : "#555"} />
          <Text style={[styles.actionText, currentReaction === ReactionType.Like && {color: "#EB3C58"}]}>Like</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onCommentPress && onCommentPress(post.postID)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#555" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onSharePress && onSharePress(post.postID)}
        >
          <Ionicons name="share-social-outline" size={24} color="#555" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 0,
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
    width: '100%', // Image component thường chấp nhận '100%'
    height: POST_IMAGE_HEIGHT,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statsText: {
    fontSize: 13,
    color: '#555',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionButtonActive: {},
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
});

export default PostCard;