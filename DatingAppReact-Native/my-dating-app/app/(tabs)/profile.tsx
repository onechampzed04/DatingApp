import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Button,
  StyleSheet,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  getUserById,
  getUserInterests,
  ApiUser,
  Interest,
  API_BASE_URL,
  Post,
  getPosts,
} from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostCard from '../../components/posts/PostCard';

const FALLBACK_AVATAR_SMALL = require('../../assets/images/dating-app.png');

const calculateAge = (birthdateString?: string | null): number | null => {
  if (!birthdateString) return null;
  const birthDate = new Date(birthdateString);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const ProfileHeader = ({ avatarSource, onEdit, onFriends }: { avatarSource: any; onEdit: () => void; onFriends: () => void }) => (
  <>
    <Image source={avatarSource} style={styles.headerImage} />
    <View style={styles.actionRow}>
      <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
        <Text style={styles.icon}>✖️</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButtonCenter}>
        <Text style={styles.iconCenter}>❤️</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={onFriends}>
        <Text style={styles.icon}>⭐</Text>
      </TouchableOpacity>
    </View>
  </>
);

const ProfileSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const InterestItem = ({ name }: { name: string }) => (
  <View style={styles.interest}>
    <Text style={styles.interestText}>{name}</Text>
  </View>
);

const UserProfileScreen = () => {
  const { user: authUser, logout } = useAuth();
  const router = useRouter();
  const [profileState, setProfileState] = useState<{
    userData: ApiUser | null;
    interests: Interest[];
    loading: boolean;
    userId: number | null;
  }>({
    userData: null,
    interests: [],
    loading: true,
    userId: null,
  });

  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isRefreshingPosts, setIsRefreshingPosts] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);

  const POSTS_PAGE_SIZE = 5;
  const postsIsMounted = useRef(false);

  const fetchProfileData = useCallback(async (userIdToFetch: number) => {
    console.log(`[UserProfileScreen] Fetching profile data for userID: ${userIdToFetch}`);
    setProfileState((prev) => ({ ...prev, loading: true }));
    try {
      const [profile, interests] = await Promise.all([
        getUserById(userIdToFetch),
        getUserInterests(userIdToFetch),
      ]);
      setProfileState((prev) => ({ ...prev, userData: profile, interests: interests || [] }));
    } catch (error: any) {
      console.error('Failed to fetch profile data:', error);
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.', [{ text: 'OK', onPress: logout }]);
      } else {
        Alert.alert('Error', 'Could not load profile data.');
      }
    } finally {
      setProfileState((prev) => ({ ...prev, loading: false }));
    }
  }, [logout]);

  const fetchUserPostsData = useCallback(async (userIdToFetchPosts: number, pageNum: number, isRefreshAction = false) => {
  if (!userIdToFetchPosts) return;
  console.log(`[UserProfileScreen] Fetching posts for userID: ${userIdToFetchPosts}, Page: ${pageNum}, Refresh: ${isRefreshAction}`);

  // Sử dụng trực tiếp giá trị state hiện tại thay vì đưa vào dependency của useCallback
  // if (!isRefreshAction && ((isLoadingMorePosts && pageNum > 1) || (!hasMorePosts && pageNum > 1))) {
  //   return;
  // }
  // -> Logic này có thể không cần thiết nếu các cờ loading được quản lý tốt

  if (isRefreshAction) {
    // Chỉ set refreshing nếu thực sự là hành động refresh từ người dùng hoặc focus
    // Nếu chỉ là load lần đầu (pageNum === 1 và không phải isRefreshAction), thì isLoadingPosts sẽ xử lý
    if (pageNum === 1) setIsRefreshingPosts(true);
  } else if (pageNum === 1) {
    setIsLoadingPosts(true);
  } else {
    // Chỉ set isLoadingMorePosts nếu thực sự đang load thêm và chưa có request nào đang chạy
    if (!isLoadingMorePosts && hasMorePosts) { // Thêm kiểm tra hasMorePosts
        setIsLoadingMorePosts(true);
    } else {
        // Nếu đang loading hoặc không còn gì để load, không làm gì cả
        if (isLoadingMorePosts) console.log("[fetchUserPostsData] Already loading more, bailing.");
        if (!hasMorePosts) console.log("[fetchUserPostsData] No more posts, bailing.");
        return;
    }
  }

  try {
    const newPosts = await getPosts(pageNum, POSTS_PAGE_SIZE, userIdToFetchPosts);
    if (!postsIsMounted.current) return;

    if (newPosts.length < POSTS_PAGE_SIZE) {
      setHasMorePosts(false);
    } else {
      // Nếu fetch thành công và có dữ liệu = PAGE_SIZE, giả định là còn nữa
      // (trừ khi API trả về thông tin đã hết)
      setHasMorePosts(true);
    }

    setUserPosts(prevPosts => {
      const finalPosts = (pageNum === 1 || isRefreshAction) ? newPosts : [...prevPosts, ...newPosts];
      const uniquePosts = Array.from(new Map(finalPosts.map(p => [p.postID, p])).values());
      return uniquePosts;
    });

    if (newPosts.length > 0 && !isRefreshAction) { // Chỉ tăng page nếu không phải refresh và có post mới
      setPostsPage(pageNum + 1);
    } else if (isRefreshAction) {
      setPostsPage(2); // Sau khi refresh, trang tiếp theo sẽ là 2
    }
  } catch (error) {
    console.error(`Failed to fetch posts for user ${userIdToFetchPosts}:`, error);
    if (postsIsMounted.current) setHasMorePosts(false); // An toàn khi có lỗi
  } finally {
    if (!postsIsMounted.current) return;
    if (isRefreshAction && pageNum === 1) setIsRefreshingPosts(false);
    if (pageNum === 1 && !isRefreshAction) setIsLoadingPosts(false);
    // Luôn reset isLoadingMorePosts sau khi hoàn tất, bất kể thành công hay thất bại
    if (!isRefreshAction && pageNum > 1) setIsLoadingMorePosts(false);
  }
  // Bỏ hasMorePosts, isLoadingMorePosts khỏi dependencies
  // POSTS_PAGE_SIZE là hằng số, không cần đưa vào
}, [POSTS_PAGE_SIZE]); // Dependency array có thể chỉ cần các hằng số hoặc props ổn định

  useEffect(() => {
    const fetchInitialUserId = async () => {
      let idToFetch: number | null = null;
      if (authUser?.userId) {
        idToFetch = authUser.userId;
      } else {
        const userIdStr = await AsyncStorage.getItem('userId');
        if (userIdStr) {
          idToFetch = parseInt(userIdStr, 10);
        }
      }

      if (idToFetch) {
        setProfileState((prev) => ({ ...prev, userId: idToFetch, loading: false }));
      } else {
        Alert.alert('Error', 'User not identified. Please log in.', [{ text: 'OK', onPress: logout }]);
        setProfileState((prev) => ({ ...prev, loading: false, userId: null }));
      }
    };
    fetchInitialUserId();
  }, [authUser, logout]);

  useFocusEffect(
    useCallback(() => {
      postsIsMounted.current = true;
      const currentUserIdToFetch = profileState.userId;

      if (currentUserIdToFetch) {
        console.log(`[UserProfileScreen] Screen focused. Fetching data for user ID: ${currentUserIdToFetch}`);
        fetchProfileData(currentUserIdToFetch);
        setUserPosts([]);
        setPostsPage(1);
        setHasMorePosts(true);
        fetchUserPostsData(currentUserIdToFetch, 1, true);
      }
      return () => {
        postsIsMounted.current = false;
      };
    }, [profileState.userId, fetchProfileData, fetchUserPostsData])
  );

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const navigateToEditProfile = () => router.push('/(setup)/edit-profile');
  const navigateToFriendList = () => router.push('/(tabs)/interaction/friend-list');
  const navigateToCreatePost = () => router.push('../post-detail/createpost');
  const navigateToPostDetailFromProfile = (postId: number) => {
    router.push({ pathname: '/(tabs)/post-detail/[postId]', params: { postId: postId.toString() } });
  };

  const handleUpdatePostInProfileList = (updatedPost: Post) => {
    setUserPosts(prevPosts =>
      prevPosts.map(p => (p.postID === updatedPost.postID ? updatedPost : p))
    );
  };

  const handleRefreshPosts = () => {
    if (profileState.userId && !isRefreshingPosts) {
      setPostsPage(1);
      setHasMorePosts(true);
      fetchUserPostsData(profileState.userId, 1, true);
    }
  };

  const handleLoadMorePosts = () => {
    if (profileState.userId && !isLoadingMorePosts && hasMorePosts) {
      fetchUserPostsData(profileState.userId, postsPage);
    }
  };

  const { loading, userData, interests, userId } = profileState;

  if (loading && !userData) {
    return (
      <View style={styles.centeredLoader}>
        <ActivityIndicator size="large" color="#eb3c58" />
      </View>
    );
  }

  if (!userData || !userId) {
    return (
      <View style={styles.centeredLoader}>
        <Text>Could not load user profile. Please try again or log in.</Text>
      </View>
    );
  }

  const age = calculateAge(userData.birthdate);
  const displayNameAndAge = `${userData.fullName || userData.username || ''}${age ? `, ${age}` : ''}`;

  let finalAvatarUri: string | null = null;
  if (userData.avatar) {
    finalAvatarUri = userData.avatar.startsWith('http') ? userData.avatar : `${API_BASE_URL}${userData.avatar}`;
  }
  const avatarSource = finalAvatarUri ? { uri: finalAvatarUri } : FALLBACK_AVATAR_SMALL;

  const renderCreatePostHeader = () => (
    <View style={styles.createPostSection}>
      <Image source={avatarSource} style={styles.createPostAvatar} />
      <TouchableOpacity style={styles.createPostInputContainer} onPress={navigateToCreatePost}>
        <Text style={styles.createPostInputPlaceholder}>What's on your mind?</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={navigateToCreatePost} style={styles.createPostMediaButton}>
        <Ionicons name="images-outline" size={24} color="#4CAF50" />
      </TouchableOpacity>
    </View>
  );

  const ListHeader = () => (
    <>
      <ProfileHeader avatarSource={avatarSource} onEdit={navigateToEditProfile} onFriends={navigateToFriendList} />
      <View style={styles.profileDetails}>
        <Text style={styles.name}>{displayNameAndAge}</Text>
        <Text style={styles.subtitle}>{userData.bio || 'Chưa có giới thiệu bản thân.'}</Text>
        <ProfileSection title="About">
          <Text style={styles.about}>{userData.bio || 'Không có thông tin giới thiệu.'}</Text>
        </ProfileSection>
        <ProfileSection title="Interests">
          <View style={styles.interestsRow}>
            {interests.length > 0 ? (
              interests.map((interest) => <InterestItem key={interest.interestId} name={interest.interestName} />)
            ) : (
              <Text style={styles.noInterestsText}>Chưa có sở thích nào.</Text>
            )}
          </View>
        </ProfileSection>
        {renderCreatePostHeader()}
        <Text style={styles.sectionTitle}>My Posts</Text>
      </View>
    </>
  );

  return (
    <FlatList
      ListHeaderComponent={ListHeader}
      data={userPosts}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 10 }}>
          <PostCard
            post={item}
            onCommentPress={() => navigateToPostDetailFromProfile(item.postID)}
            onSharePress={(postId) => console.log('Share post:', postId)}
            onUpdatePost={handleUpdatePostInProfileList}
          />
        </View>
      )}
      keyExtractor={(item) => item.postID.toString()}
      ListEmptyComponent={
        !isLoadingPosts && !isRefreshingPosts && userPosts.length === 0 ? (
          <View style={styles.noPostsContainerList}>
            <Ionicons name="newspaper-outline" size={50} color="#ccc" />
            <Text style={styles.noPostsText}>This user hasn't posted anything yet.</Text>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshingPosts || (loading && !!userData)}
          onRefresh={handleRefreshPosts}
          colors={['#eb3c58']}
        />
      }
      onEndReached={handleLoadMorePosts}
      onEndReachedThreshold={0.7}
      ListFooterComponent={
        isLoadingMorePosts ? (
          <ActivityIndicator style={{ marginVertical: 20 }} />
        ) : !hasMorePosts && userPosts.length > 0 ? (
          <Text style={styles.noMorePostsText}>No more posts</Text>
        ) : null
      }
      contentContainerStyle={styles.container}
    />
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingBottom: 20,
  },
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerImage: {
    width: '100%',
    height: 350,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#e0e0e0',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: -35,
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  actionButtonCenter: {
    backgroundColor: '#eb3c58',
    padding: 24,
    borderRadius: 35,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
  },
  icon: {
    fontSize: 22,
  },
  iconCenter: {
    fontSize: 26,
    color: '#fff',
  },
  profileDetails: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: 'gray',
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#444',
    marginTop: 24,
    marginBottom: 12,
  },
  about: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  interest: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 10,
  },
  interestText: {
    color: '#333',
    fontSize: 15,
  },
  noInterestsText: {
    color: '#777',
    fontStyle: 'italic',
  },
  createPostSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 20,
    marginBottom: 10,
  },
  createPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  createPostInputContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    backgroundColor: '#f7f7f7',
  },
  createPostInputPlaceholder: {
    color: '#888',
    fontSize: 15,
  },
  createPostMediaButton: {
    marginLeft: 10,
    padding: 5,
  },
  noPostsContainerList: {
    alignItems: 'center',
    paddingVertical: 50,
    justifyContent: 'center',
  },
  noPostsText: {
    marginTop: 10,
    fontSize: 16,
    color: '#777',
  },
  noMorePostsText: {
    textAlign: 'center',
    color: '#888',
    paddingVertical: 20,
    fontSize: 14,
  },
});