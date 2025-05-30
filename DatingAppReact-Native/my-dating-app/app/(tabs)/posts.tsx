// app/(tabs)/posts.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Post, getPosts, API_BASE_URL } from '../../utils/api';
import PostCard from '../../components/posts/PostCard';
import { useAuth } from '../context/AuthContext';

const FALLBACK_AVATAR = require('../../assets/images/dating-app.png');

export default function PostsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const PAGE_SIZE = 5;
  const isMounted = useRef(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    console.log('[PostsScreen State Update] isLoading:', isLoading, 'page:', page, 'posts.length:', posts.length, 'hasMore:', hasMore, 'isRefreshing:', isRefreshing, 'isLoadingMore:', isLoadingMore);
  }, [isLoading, page, posts.length, hasMore, isRefreshing, isLoadingMore]);

  const fetchPostsData = useCallback(async (pageNum: number, isRefreshAction = false) => {
    console.log(`[fetchPostsData] Called. Page: ${pageNum}, Refresh: ${isRefreshAction}, HasMore: ${hasMore}, IsLoadingMore: ${isLoadingMore}`);

    if (!isRefreshAction && ((isLoadingMore && pageNum > 1) || (!hasMore && pageNum > 1))) {
      console.log(`[fetchPostsData] Bailing: isLoadingMore=${isLoadingMore}, hasMore=${hasMore}`);
      if (pageNum === 1) setIsLoading(false);
      return;
    }

    if (isRefreshAction) {
      setIsRefreshing(true);
    } else if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const newPosts = await getPosts(pageNum, PAGE_SIZE);
      if (!isMounted.current) return;

      if (newPosts.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setPosts(prevPosts => {
        const finalPosts = (pageNum === 1 || isRefreshAction) ? newPosts : [...prevPosts, ...newPosts];
        const uniquePosts = Array.from(new Map(finalPosts.map(p => [p.postID, p])).values());
        return uniquePosts;
      });

      if (newPosts.length > 0) {
        setPage(pageNum + 1);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      if (isMounted.current) setHasMore(false);
    } finally {
      if (!isMounted.current) return;
      if (isRefreshAction) setIsRefreshing(false);
      if (pageNum === 1) {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
      if (!isRefreshAction && pageNum > 1) setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore]);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      console.log("PostsScreen focused.");

      if (posts.length === 0 || !initialLoadDone.current) {
        console.log("Initiating data fetch on focus (posts empty or initial load not done).");
        setPage(1);
        setHasMore(true);
        setIsLoading(true);
        fetchPostsData(1, false);
      } else {
        console.log("Data already loaded, skipping fetch on focus.");
      }

      return () => {
        console.log("PostsScreen unfocused/unmounted.");
        isMounted.current = false;
      };
    }, [fetchPostsData])
  );

  const handleRefresh = () => {
    if (isRefreshing) return;
    console.log("handleRefresh triggered");
    setPage(1);
    setHasMore(true);
    fetchPostsData(1, true);
  };

  const handleLoadMore = () => {
    console.log("handleLoadMore triggered. isLoadingMore:", isLoadingMore, "hasMore:", hasMore);
    if (!isLoadingMore && hasMore) {
      fetchPostsData(page);
    }
  };

  const handleUpdatePostInList = (updatedPost: Post) => {
    setPosts(prevPosts =>
      prevPosts.map(p => (p.postID === updatedPost.postID ? updatedPost : p))
    );
  };

  const navigateToCreatePost = () => {
    router.push('../post-detail/createpost');
  };

  const navigateToPostDetail = (postId: number) => {
    router.push({ pathname: '/(tabs)/post-detail/[postId]', params: { postId: postId.toString() } });
  };

  const userAvatarUrl = user?.avatar
    ? (user.avatar.startsWith('http') ? user.avatar : `${API_BASE_URL}${user.avatar}`)
    : undefined;

  const renderHeader = () => (
    <View style={styles.createPostHeader}>
      <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.headerAvatarContainer}>
        <Image
          source={userAvatarUrl ? { uri: userAvatarUrl } : FALLBACK_AVATAR}
          style={styles.headerAvatar}
        />
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerInputContainer} onPress={navigateToCreatePost}>
        <Text style={styles.headerInputPlaceholder}>What's on your mind, {user?.fullName || user?.username}?</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={navigateToCreatePost} style={styles.headerMediaButton}>
        <Ionicons name="images-outline" size={24} color="#E5435A" />
      </TouchableOpacity>
    </View>
  );

  const renderListFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color="#E5435A" />
      </View>
    );
  };

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E5435A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => {
          console.log(
            `[PostsScreen] Data for PostID ${item.postID}:`,
            JSON.stringify(item.reactionCounts, null, 2),
            "TotalReactions:",
            item.totalReactions
          );

          return (
            <PostCard
              post={item}
              onCommentPress={() => navigateToPostDetail(item.postID)}
              onSharePress={(postId) => console.log("Share post:", postId)}
              onUpdatePost={handleUpdatePostInList}
            />
          );
        }}
        keyExtractor={(item) => item.postID.toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={
          !isLoading && !isRefreshing && !isLoadingMore ? (
            <View style={styles.emptyListContainer}>
              <Ionicons name="cafe-outline" size={60} color="#A1A1A1" />
              <Text style={styles.emptyListText}>No posts to show right now.</Text>
              <Text style={styles.emptyListSubText}>Be the first to share something or check back later!</Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={["#E5435A"]} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderListFooter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8', // Softer gray for modern look
  },
  listContentContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
  },
  // Enhanced Header Styles
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginHorizontal: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerAvatarContainer: {
    marginRight: 12,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E5435A',
  },
  headerInputContainer: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    borderColor: '#E5435A',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 15,
    backgroundColor: '#FFF5F6',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerInputPlaceholder: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  headerMediaButton: {
    marginLeft: 12,
    padding: 8,
    backgroundColor: '#FFF5F6',
    borderRadius: 12,
  },
  // Enhanced Empty List Styles
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyListText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyListSubText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  // Loading More
  loadingMoreContainer: {
    paddingVertical: 25,
    alignItems: 'center',
  },
  // FAB (Commented out, but keeping enhanced styles if needed)
  fabCreatePost: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#E5435A',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});