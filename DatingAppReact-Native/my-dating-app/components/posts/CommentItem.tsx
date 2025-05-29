// components/posts/CommentItem.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { PostComment, API_BASE_URL } from '../../utils/api';
import { formatDistanceToNowStrict } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

const FALLBACK_AVATAR = require('../../assets/images/dating-app.png');

interface CommentItemProps {
  comment: PostComment;
  postId: number;
  currentUserId?: number;
  onReplyPress?: (comment: PostComment) => void;
  onLoadReplies?: (comment: PostComment) => Promise<void>;
  depth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({ 
  comment, 
  postId, 
  currentUserId, 
  onReplyPress, 
  onLoadReplies, 
  depth = 0 
}) => {
  // Defensive check for the comment object itself
  if (!comment || typeof comment !== 'object' || !comment.postCommentID) {
    console.error("CommentItem received invalid comment prop:", comment);
    return null; // Do not render anything if the base comment data is invalid
  }

  const user = comment.user;
  const avatarUrl = user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `${API_BASE_URL}${user.avatar}`) : null;
  
  // Ensure user object and its properties are handled safely for display name
  const displayName = useMemo(() => {
    if (user && typeof user === 'object') {
      return String(user.fullName || user.username || 'User');
    }
    return 'Unknown User';
  }, [user]);

  const timeAgo = useMemo(() => {
    try {
      if (!comment.createdAt) return "some time ago";
      const date = new Date(comment.createdAt);
      if (isNaN(date.getTime())) return "invalid date";
      return formatDistanceToNowStrict(date, { addSuffix: true });
    } catch (e) {
      return "error formatting date";
    }
  }, [comment.createdAt]);
  
  const [localShowReplies, setLocalShowReplies] = useState(false);
  const [isCurrentlyLoadingReplies, setIsCurrentlyLoadingReplies] = useState(false);

  const handleToggleReplies = async () => {
    if (isCurrentlyLoadingReplies) return;

    if (!localShowReplies) {
      const alreadyLoadedSufficiently = comment.replies && comment.replies.length >= (comment.repliesCount || 0);
      
      if (onLoadReplies && (comment.repliesCount || 0) > 0 && !alreadyLoadedSufficiently) {
        setIsCurrentlyLoadingReplies(true);
        try {
          await onLoadReplies(comment);
        } finally {
          setIsCurrentlyLoadingReplies(false);
        }
      }
    }
    setLocalShowReplies(prev => !prev);
  };

  let viewRepliesTextContent = "";
  const repliesCount = comment.repliesCount || 0; // Use 0 if undefined or null

  if (repliesCount > 0) {
    if (isCurrentlyLoadingReplies) {
      viewRepliesTextContent = "Loading...";
    } else if (localShowReplies) {
      viewRepliesTextContent = "Hide replies";
    } else {
      viewRepliesTextContent = `View ${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}`;
    }
  }
  
  // Explicitly ensure comment.content is a string, defaulting to empty if null/undefined
  const commentText = String(comment.content ?? '');

  return (
    <View style={[styles.container, { marginLeft: depth * 15 }]}>
      <Image source={avatarUrl ? { uri: avatarUrl } : FALLBACK_AVATAR} style={styles.avatar} />
      <View style={styles.commentContent}>
        <View style={styles.commentBubble}>
            <Text style={styles.username}>{displayName}</Text>
            <Text style={styles.text}>{commentText}</Text> 
        </View>
        <View style={styles.commentActions}>
            <Text style={styles.timestamp}>{timeAgo}</Text>
            {onReplyPress && (
              <TouchableOpacity onPress={() => onReplyPress(comment)} style={styles.actionLink}>
                  <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
            )}
        </View>
        
        {viewRepliesTextContent ? (
          <TouchableOpacity 
            onPress={handleToggleReplies} 
            disabled={isCurrentlyLoadingReplies && !localShowReplies}
            style={styles.viewRepliesButton}
          >
            <Text style={styles.viewRepliesText}>{viewRepliesTextContent}</Text>
            {isCurrentlyLoadingReplies ? <ActivityIndicator size="small" color="#007bff" style={{marginLeft: 5}}/> : null}
          </TouchableOpacity>
        ) : null}

        {localShowReplies && comment.replies && comment.replies.length > 0 && (
            <View style={styles.repliesContainer}>
                {comment.replies.map(reply => {
                    // Add a stronger check for each reply object before rendering CommentItem
                    if (!reply || typeof reply !== 'object' || !reply.postCommentID || !reply.user) {
                        console.warn("Skipping malformed reply object in CommentItem map:", reply);
                        return null; // Important: Skip rendering if reply is malformed
                    }
                    return (
                        <CommentItem 
                            key={reply.postCommentID} 
                            comment={reply} 
                            postId={postId} 
                            currentUserId={currentUserId} 
                            onReplyPress={onReplyPress}
                            onLoadReplies={onLoadReplies}
                            depth={depth + 1}
                        />
                    );
                })}
            </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#f0f2f5',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 3,
    color: '#333'
  },
  text: {
    fontSize: 14,
    lineHeight: 19,
    color: '#333'
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    paddingLeft: 5,
  },
  timestamp: {
    fontSize: 11,
    color: '#777',
    marginRight: 10,
  },
  actionLink: {
    marginRight: 10,
  },
  actionText: {
    fontSize: 11,
    color: '#555',
    fontWeight: 'bold',
  },
  viewRepliesButton: {
    marginTop: 5,
    paddingLeft: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewRepliesText: {
    color: '#007bff',
    fontSize: 12,
    fontWeight: '600',
  },
  repliesContainer: {
    marginTop: 8,
  },
});

export default CommentItem;