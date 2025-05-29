// app/(tabs)/posts.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Thêm useRef
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, Image } from 'react-native'; // Thêm TextInput, Image
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Post, getPosts, API_BASE_URL } from '../../utils/api'; // Điều chỉnh đường dẫn
import PostCard from '../../components/posts/PostCard'; // Điều chỉnh đường dẫn
import { useAuth } from '../context/AuthContext'; // Điều chỉnh đường dẫn

const FALLBACK_AVATAR = require('../../assets/images/dating-app.png'); // Đường dẫn đến avatar mặc định

export default function PostsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Khởi tạo là false, sẽ set true khi focus
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const PAGE_SIZE = 5;
  const isMounted = useRef(false); // Để kiểm tra component đã mount chưa, tránh set state không cần thiết
  const initialLoadDone = useRef(false); 
  // Log để theo dõi
  useEffect(() => {
    console.log('[PostsScreen State Update] isLoading:', isLoading, 'page:', page, 'posts.length:', posts.length, 'hasMore:', hasMore, 'isRefreshing:', isRefreshing, 'isLoadingMore:', isLoadingMore);
  }, [isLoading, page, posts.length, hasMore, isRefreshing, isLoadingMore]);


  const fetchPostsData = useCallback(async (pageNum: number, isRefreshAction = false) => {
    console.log(`[fetchPostsData] Called. Page: ${pageNum}, Refresh: ${isRefreshAction}, HasMore: ${hasMore}, IsLoadingMore: ${isLoadingMore}`);

    if (!isRefreshAction && ((isLoadingMore && pageNum > 1) || (!hasMore && pageNum > 1))) {
      console.log(`[fetchPostsData] Bailing: isLoadingMore=${isLoadingMore}, hasMore=${hasMore}`);
      if (pageNum === 1) setIsLoading(false); // Nếu là lần tải đầu mà bị bail
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
          initialLoadDone.current = true; // Đánh dấu lần tải đầu đã xong
      }
      if (!isRefreshAction && pageNum > 1) setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore]); // Các dependencies này nên ổn định


  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      console.log("PostsScreen focused.");

      // Chỉ fetch dữ liệu nếu chưa có posts hoặc chưa thực hiện initial load
      // Hoặc nếu bạn muốn luôn fetch lại khi focus, thì bỏ điều kiện initialLoadDone
      if (posts.length === 0 || !initialLoadDone.current) {
        console.log("Initiating data fetch on focus (posts empty or initial load not done).");
        setPage(1);
        setHasMore(true);
        // setPosts([]); // Không cần setPosts([]) ở đây nếu fetchPostsData(1,...) sẽ ghi đè
        setIsLoading(true); // Quan trọng: set loading trước khi fetch
        fetchPostsData(1, false);
      } else {
        console.log("Data already loaded, skipping fetch on focus.");
      }

      return () => {
        console.log("PostsScreen unfocused/unmounted.");
        isMounted.current = false;
        // Không reset initialLoadDone.current ở đây, vì nó đánh dấu trạng thái của màn hình này
      };
    }, [fetchPostsData]) // fetchPostsData giờ đây là dependency.
                         // Hãy đảm bảo dependencies của fetchPostsData ([hasMore, isLoadingMore]) không thay đổi một cách không cần thiết
  );

  const handleRefresh = () => {
    if (isRefreshing) return;
    console.log("handleRefresh triggered");
    setPage(1);
    setHasMore(true);
    // setPosts([]); // Không cần thiết vì fetchPostsData với isRefreshAction=true sẽ ghi đè
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
    router.push('../post-detail/createpost'); // Điều chỉnh nếu đường dẫn của bạn khác
  };

  const navigateToPostDetail = (postId: number) => {
    router.push({pathname: `/(tabs)/post-detail/[postId]`, params: {postId: postId.toString()}});
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
        <Ionicons name="images-outline" size={24} color="#4CAF50" />
      </TouchableOpacity>
    </View>
  );

  const renderListFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMoreContainer}>
        <ActivityIndicator size="small" color="#888" />
      </View>
    );
  };

  // --- Hiển thị Loading Indicator toàn màn hình cho lần tải đầu tiên ---
  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#EB3C58" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => (
            <PostCard
                post={item}
                onCommentPress={() => navigateToPostDetail(item.postID)}
                onSharePress={(postId) => console.log("Share post:", postId)}
                onUpdatePost={handleUpdatePostInList}
            />
        )}
        keyExtractor={(item) => item.postID.toString()}
        ListHeaderComponent={renderHeader} // << THÊM HEADER Ở ĐÂY
        contentContainerStyle={styles.listContentContainer}
        ListEmptyComponent={ // Chỉ hiển thị khi posts rỗng VÀ không còn loading/refreshing
          !isLoading && !isRefreshing && !isLoadingMore ? (
            <View style={styles.emptyListContainer}>
              <Ionicons name="cafe-outline" size={60} color="#ccc" />
              <Text style={styles.emptyListText}>No posts to show right now.</Text>
              <Text style={styles.emptyListSubText}>Be the first to share something or check back later!</Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={["#EB3C58"]} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderListFooter}
      />
      {/* Bạn có thể bỏ FAB nếu đã có ô tạo bài viết ở header */}
      {/* <TouchableOpacity style={styles.fabCreatePost} onPress={navigateToCreatePost}>
            <Ionicons name="add" size={30} color="#fff" />
       </TouchableOpacity> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  listContentContainer: {
    paddingHorizontal: 0, // Cho Card tự cách lề nếu cần
    paddingVertical: 5,
    // paddingBottom: 80, // Không cần nếu không có FAB
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f2f5',
  },
  // Styles cho Header tạo bài viết
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 8, // Khoảng cách với post đầu tiên
  },
  headerAvatarContainer:{
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eee',
  },
  headerInputContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    backgroundColor: '#f7f7f7'
  },
  headerInputPlaceholder: {
    color: '#888',
    fontSize: 15,
  },
  headerMediaButton: {
    marginLeft: 10,
    padding: 5,
  },
  // Styles cho khi list rỗng
  emptyListContainer: {
    flex: 1, // Để chiếm không gian nếu không có post
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 50, // Để không bị header che khuất quá nhiều
  },
  emptyListText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginTop: 15,
    textAlign: 'center',
  },
  emptyListSubText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
  },
  fabCreatePost: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    backgroundColor: '#EB3C58',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});