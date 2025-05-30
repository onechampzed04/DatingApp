// app/(tabs)/profile.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
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

const ProfileHeader = ({ avatarSource, onEdit, onSettings, onMatches }: { avatarSource: any; onEdit: () => void; onSettings: () => void; onMatches: () => void; }) => (
  <View style={styles.headerContainer}>
    <Image source={avatarSource} style={styles.headerImage} />
    <View style={styles.actionRow}>
      <TouchableOpacity style={styles.actionButton} onPress={onEdit} activeOpacity={0.7}>
        <Ionicons name="pencil-outline" size={24} color="#E5435A" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButtonCenter} onPress={onMatches} activeOpacity={0.7}>
        <Ionicons name="heart-outline" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={onSettings} activeOpacity={0.7}>
        <Ionicons name="settings-outline" size={24} color="#E5435A" />
      </TouchableOpacity>
    </View>
  </View>
);

const ProfileSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.sectionContainer}>
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

    if (isRefreshAction) {
      if (pageNum === 1) setIsRefreshingPosts(true);
    } else if (pageNum === 1) {
      setIsLoadingPosts(true);
    } else {
      if (!isLoadingMorePosts && hasMorePosts) {
        setIsLoadingMorePosts(true);
      } else {
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
        setHasMorePosts(true);
      }

      setUserPosts(prevPosts => {
        const finalPosts = (pageNum === 1 || isRefreshAction) ? newPosts : [...prevPosts, ...newPosts];
        const uniquePosts = Array.from(new Map(finalPosts.map(p => [p.postID, p])).values());
        return uniquePosts;
      });

      if (newPosts.length > 0 && !isRefreshAction) {
        setPostsPage(pageNum + 1);
      } else if (isRefreshAction) {
        setPostsPage(2);
      }
    } catch (error) {
      console.error(`Failed to fetch posts for user ${userIdToFetchPosts}:`, error);
      if (postsIsMounted.current) setHasMorePosts(false);
    } finally {
      if (!postsIsMounted.current) return;
      if (isRefreshAction && pageNum === 1) setIsRefreshingPosts(false);
      if (pageNum === 1 && !isRefreshAction) setIsLoadingPosts(false);
      if (!isRefreshAction && pageNum > 1) setIsLoadingMorePosts(false);
    }
  }, [POSTS_PAGE_SIZE]);

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
  const navigateToSettings = () => router.push('/(tabs)/settings');
  const navigateToUserMatches = () => {
    if (userId) {
      router.push(`../(tabs)/user-matches/${userId}`);
    } else {
      Alert.alert("Error", "User ID not found to view matches.");
    }
  };
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
        <ActivityIndicator size="large" color="#E5435A" />
      </View>
    );
  }

  if (!userData || !userId) {
    return (
      <View style={styles.centeredLoader}>
        <Text style={styles.errorText}>Could not load user profile. Please try again or log in.</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.logoutButtonText}>Log In</Text>
        </TouchableOpacity>
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
      <TouchableOpacity onPress={navigateToEditProfile} style={styles.createPostAvatarContainer} activeOpacity={0.7}>
        <Image source={avatarSource} style={styles.createPostAvatar} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.createPostInputContainer} onPress={navigateToCreatePost} activeOpacity={0.7}>
        <Text style={styles.createPostInputPlaceholder}>What's on your mind?</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={navigateToCreatePost} style={styles.createPostMediaButton} activeOpacity={0.7}>
        <Ionicons name="images-outline" size={26} color="#E5435A" />
      </TouchableOpacity>
    </View>
  );

  const ListHeader = () => (
    <>
      <ProfileHeader avatarSource={avatarSource} onEdit={navigateToEditProfile} onSettings={navigateToSettings} onMatches={navigateToUserMatches} />
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
        <View style={styles.postContainer}>
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
            <Ionicons name="newspaper-outline" size={60} color="#A1A1A1" />
            <Text style={styles.noPostsText}>You haven't posted anything yet.</Text>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshingPosts || (loading && !!userData)}
          onRefresh={handleRefreshPosts}
          colors={['#E5435A']}
        />
      }
      onEndReached={handleLoadMorePosts}
      onEndReachedThreshold={0.7}
      ListFooterComponent={
        isLoadingMorePosts ? (
          <ActivityIndicator style={{ marginVertical: 20 }} color="#E5435A" />
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
    backgroundColor: '#F5F6F8',
    paddingBottom: 20,
  },
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    padding: 20,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerImage: {
    width: '100%',
    height: 280,
    backgroundColor: '#E5E5E5',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: -40,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E5435A22',
  },
  actionButtonCenter: {
    backgroundColor: '#E5435A',
    padding: 18,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  profileDetails: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
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
    marginBottom: 10,
  },
  interest: {
    backgroundColor: '#FFF5F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5435A33',
  },
  interestText: {
    color: '#E5435A',
    fontSize: 15,
    fontWeight: '500',
  },
  noInterestsText: {
    color: '#777',
    fontSize: 15,
    fontStyle: 'italic',
  },
  createPostSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E5435A11',
  },
  createPostAvatarContainer: {
    marginRight: 12,
  },
  createPostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E5435A',
    backgroundColor: '#F5F6F8',
  },
  createPostInputContainer: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    backgroundColor: '#FFF5F6',
    borderRadius: 22,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E5435A44',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  createPostInputPlaceholder: {
    color: '#4A4A4A',
    fontSize: 16,
    fontWeight: '600',
  },
  createPostMediaButton: {
    marginLeft: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5435A15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5435A33',
  },
  noPostsContainerList: {
    alignItems: 'center',
    paddingVertical: 50,
    justifyContent: 'center',
  },
  noPostsText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  noMorePostsText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 20,
    fontSize: 15,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#E5435A',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginVertical: 20,
    marginHorizontal: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  postContainer: {
    paddingHorizontal: 15,
    marginVertical: 8,
  },
});