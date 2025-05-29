import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'; // Added useMemo
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Post, PostComment, getPostById, getPostComments, addCommentToPost, PostCommentCreateData, API_BASE_URL } from '../../../utils/api';
import PostCard from '../../../components/posts/PostCard';
import CommentItem from '../../../components/posts/CommentItem';
import { useAuth } from '../../context/AuthContext';

export default function PostDetailScreen() {
  const { postId: postIdString } = useLocalSearchParams<{ postId: string }>();
  const postId = useMemo(() => parseInt(postIdString || '0', 10), [postIdString]); // Use useMemo for stable postId
  const router = useRouter();
  const { user: currentUser } = useAuth();
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [isLoadingPost, setIsLoadingPost] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<PostComment | null>(null);

  const commentInputRef = useRef<TextInput>(null);
  const isFetchingRepliesRef = useRef<Record<number, boolean>>({}); // Prevents multiple fetches for same parent

  const [commentPage, setCommentPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(true); // For root comments pagination

  const fetchPostDetails = useCallback(async () => {
    if (!postId) return;
    setIsLoadingPost(true);
    try {
      const fetchedPost = await getPostById(postId);
      setPost(fetchedPost);
    } catch (error) {
      console.error("Failed to fetch post details:", error);
      Alert.alert("Error", "Could not load the post.");
    } finally {
      setIsLoadingPost(false);
    }
  }, [postId]); // Depends on stable postId

  const fetchRootComments = useCallback(async (pageNum = 1, refreshing = false) => {
    if (!postId || isLoadingComments || (!hasMoreComments && pageNum > 1 && !refreshing)) return;
    
    setIsLoadingComments(true);
    try {
      const fetchedRootComments = await getPostComments(postId, undefined, pageNum, 10);
      
      if (fetchedRootComments.length < 10) {
        setHasMoreComments(false);
      }
      
      // Initialize replies array for each comment, preserve repliesCount from server
      const commentsWithReplyPlaceholders = fetchedRootComments.map(c => ({
        ...c,
        replies: c.replies || [], // Use existing if any, else init empty. Server should send repliesCount
      }));

      setComments(prev => {
        const newSet = refreshing ? commentsWithReplyPlaceholders : [...prev, ...commentsWithReplyPlaceholders];
        // Ensure uniqueness for root comments
        return newSet.filter((comment, index, self) => 
            index === self.findIndex(c => c.postCommentID === comment.postCommentID)
        );
      });

      if (fetchedRootComments.length > 0) {
        setCommentPage(prevPage => pageNum + 1);
      }
    } catch (error) {
      console.error("Failed to fetch root comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [postId, hasMoreComments, isLoadingComments]); // isLoadingComments added to prevent parallel fetches

  useEffect(() => {
    if (postId > 0) {
      fetchPostDetails();
      // Reset state for comments when postId changes
      setComments([]);
      setCommentPage(1);
      setHasMoreComments(true);
      setIsLoadingComments(false); // Reset loading state
      fetchRootComments(1, true); // Fetch initial set of root comments
    }
  }, [postId, fetchPostDetails]); // Removed fetchRootComments from here, it will be stable or handled carefully


  const loadRepliesForComment = useCallback(async (parentComment: PostComment) => {
    if (!postId || isFetchingRepliesRef.current[parentComment.postCommentID]) {
        return;
    }
    isFetchingRepliesRef.current[parentComment.postCommentID] = true;

    try {
        // Fetch ALL replies for this parent comment. Pagination for replies can be added later.
        const repliesToFetch = parentComment.repliesCount > 0 ? parentComment.repliesCount : 10; // Example: fetch at least 10 or all
        const fetchedReplies = await getPostComments(postId, parentComment.postCommentID, 1, repliesToFetch);
        
        // Sort replies by creation time (oldest first for display order)
        const sortedFetchedReplies = fetchedReplies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        setComments(prevRootComments => {
            const updateRepliesRecursive = (commentList: PostComment[]): PostComment[] => {
                return commentList.map(c => {
                    if (c.postCommentID === parentComment.postCommentID) {
                        // Merge new replies with existing ones, ensuring no duplicates, if any logic kept old ones
                        // For now, replace with sorted, complete list.
                        return { ...c, replies: sortedFetchedReplies };
                    }
                    // If this comment itself has replies, recurse (for deeper nested replies logic if structure supports)
                    if (c.replies && c.replies.length > 0) {
                        return { ...c, replies: updateRepliesRecursive(c.replies) };
                    }
                    return c;
                });
            };
            return updateRepliesRecursive(prevRootComments);
        });
    } catch (error) {
        console.error(`Failed to load replies for comment ${parentComment.postCommentID}:`, error);
        Alert.alert("Error", "Could not load replies.");
    } finally {
        isFetchingRepliesRef.current[parentComment.postCommentID] = false;
    }
  }, [postId]); // setComments can be omitted if using functional update from useState or if it's from context & stable

  const handlePostComment = async () => {
    if (!newCommentText.trim() || !currentUser || !post || isSubmittingComment) return;
    setIsSubmittingComment(true);

    const commentData: PostCommentCreateData = {
      content: newCommentText.trim(),
      parentCommentID: replyingToComment ? replyingToComment.postCommentID : undefined,
    };

    try {
      const newComment = await addCommentToPost(post.postID, commentData);
      
      if (replyingToComment) {
        setComments(prevComments => 
          prevComments.map(rootComment => {
            // Function to find and update the parent comment (can be nested)
            const updateNestedReplies = (parent: PostComment): PostComment => {
              if (parent.postCommentID === replyingToComment.postCommentID) {
                return {
                  ...parent,
                  replies: [newComment, ...(parent.replies || [])],
                  repliesCount: (parent.repliesCount || 0) + 1,
                };
              }
              if (parent.replies && parent.replies.length > 0) {
                let foundAndUpdated = false;
                const updatedReplies = parent.replies.map(reply => {
                    if (reply.postCommentID === replyingToComment.postCommentID) {
                        foundAndUpdated = true;
                        return {
                            ...reply,
                            replies: [newComment, ...(reply.replies || [])],
                            repliesCount: (reply.repliesCount || 0) + 1,
                        };
                    }
                    if (reply.replies && reply.replies.length > 0){ // Recurse
                        const nestedUpdate = updateNestedReplies(reply);
                        if (nestedUpdate !== reply) foundAndUpdated = true; // if any change in deeper level
                        return nestedUpdate;
                    }
                    return reply;
                });
                if (foundAndUpdated) return {...parent, replies: updatedReplies};
              }
              return parent; // No change for this comment or its direct children
            };
            return updateNestedReplies(rootComment); // Apply to each root comment
          })
        );
      } else {
        // Add new root comment to the top
        setComments(prevComments => [newComment, ...prevComments]);
      }

      setPost(prevPost => prevPost ? ({...prevPost, totalComments: (prevPost.totalComments || 0) + 1}) : null);
      setNewCommentText('');
      setReplyingToComment(null);
    } catch (error) {
      console.error("Failed to post comment/reply:", error);
      Alert.alert("Error", "Could not post your comment/reply.");
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  const handleUpdatePostCard = (updatedPost: Post) => {
    setPost(updatedPost);
  };

  if (isLoadingPost || !post && postId > 0) { // Check postId > 0 to avoid loading flicker on initial mount without id
    return <View style={styles.centered}><ActivityIndicator size="large" color="#EB3C58" /></View>;
  }
   const handleReplyPress = (commentToReply: PostComment) => {
    setReplyingToComment(commentToReply);
    commentInputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingToComment(null);
  };

  const replyingToName = replyingToComment?.user 
    ? (replyingToComment.user.fullName || replyingToComment.user.username || 'User') 
    : 'User';

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 0} // Adjusted offset
    >
      <FlatList
        data={comments} // Already filtered for root by API or how they are set
        renderItem={({ item }) => (
            <CommentItem
                comment={item}
                postId={postId}
                currentUserId={currentUser?.userId}
                onReplyPress={handleReplyPress}
                onLoadReplies={loadRepliesForComment} 
            />
        )}
        keyExtractor={(item) => item.postCommentID.toString()}
        ListHeaderComponent={
          post ? <PostCard post={post} onCommentPress={() => commentInputRef.current?.focus()} isDetailView={true} onUpdatePost={handleUpdatePostCard} /> : null
        }
        ListFooterComponent={
            isLoadingComments && commentPage > 1 ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null
        }
        onEndReached={() => {
          if (hasMoreComments && !isLoadingComments) {
            fetchRootComments(commentPage); // Paginate root comments
          }
        }}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      />

      <View style={[styles.commentInputContainerOuter, replyingToComment && styles.commentInputContainerOuterWithReply]}>
        {replyingToComment && (
          <View style={styles.replyingToContainer}>
            <Text style={styles.replyingToText} numberOfLines={1}>
              Replying to {replyingToName}
            </Text>
            <TouchableOpacity onPress={cancelReply}>
              <Ionicons name="close-circle" size={20} color="#777" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentInputInnerContainer}>
            <TextInput
            ref={commentInputRef}
            style={styles.input}
            placeholder={replyingToComment ? `Reply to ${replyingToName}...` : "Write a comment..."}
            value={newCommentText}
            onChangeText={setNewCommentText}
            multiline
          />
            <TouchableOpacity onPress={handlePostComment} disabled={isSubmittingComment || !newCommentText.trim()} style={styles.sendButton}>
              {isSubmittingComment ? <ActivityIndicator color="#fff" size="small"/> : <Ionicons name="send" size={24} color="#fff" />}
            </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5', // Match common background
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 90 : 80, // Increased paddingBottom to accommodate input
    paddingHorizontal: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Styling for the comment input area
  commentInputContainerOuter: {
    position: 'absolute', // Position at the bottom
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0, // SafeArea for iOS home indicator
  },
  commentInputContainerOuterWithReply: {
    // paddingBottom: 0, // No extra padding if replying bar is shown above
  },
  commentInputInnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    // Removed backgroundColor here if outer has it
  },
  replyingToContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#eef2f5',
    // borderTopLeftRadius: 0, // Flat top for this bar
    // borderTopRightRadius: 0,
  },
  replyingToText: {
    fontSize: 13,
    color: '#555',
    flexShrink: 1, // Allow text to shrink
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    marginRight: 10,
    backgroundColor: '#f8f8f8',
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#EB3C58',
    borderRadius: 20,
    width: 40, // Made send button rounder
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
