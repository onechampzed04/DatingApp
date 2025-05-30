// app/user/[userId].tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'; // Added Stack for header
import { Ionicons, FontAwesome5 } from '@expo/vector-icons'; // Removed FontAwesome, will use FontAwesome5 for heart
import { useAuth } from '../../context/AuthContext'; // Adjusted path
import { 
  getUserDetailsById, 
  UserDetailDTO, 
  Interest, 
  API_BASE_URL,
  createSwipe, 
  SwipeMatchResponse,
  getConversationPreviews, // Import for checking existing matches
  ConversationPreviewDTO, // Import for typing
  getPosts, // Import getPosts
  Post as ApiPost // Import Post type, aliasing
} from '../../../utils/api'; 
import PostCard from '../../../components/posts/PostCard'; // Import PostCard

// --- Reusable Components (can be moved to a separate file if used elsewhere) ---
const calculateAge = (birthdateString?: string | null): number | null => {
  if (!birthdateString) return null;
  const birthDate = new Date(birthdateString);
  if (isNaN(birthDate.getTime())) return null; // Invalid date
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const ProfileHeader = ({ 
  avatarSource, 
  isCurrentUser,
  onEdit,
  onLike,
  onMessage,
  hasMatched, // New prop
  isLikeButtonLoading, // New prop
}: { 
  avatarSource: any; 
  isCurrentUser: boolean;
  onEdit?: () => void;
  onLike?: () => void; // For non-current users
  onMessage?: () => void; // For non-current users if matched
  hasMatched?: boolean; // For non-current users
  isLikeButtonLoading?: boolean;
}) => (
  <>
    <Image source={avatarSource} style={styles.headerImage} />
    <View style={styles.actionRow}>
      {isCurrentUser ? (
        <>
          <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert("Share", "Share Profile TBD")}>
            <Ionicons name="share-social-outline" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonCenter} onPress={onEdit}>
            <Ionicons name="pencil-outline" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert("Settings", "Settings TBD")}>
            <Ionicons name="settings-outline" size={22} color="#333" />
          </TouchableOpacity>
        </>
      ) : (
        // Action buttons for viewing other user's profile
        <>
          {/* Placeholder for symmetry or other action if needed */}
          <View style={styles.actionButtonPlaceholder} /> 
          
          {hasMatched ? (
            <TouchableOpacity style={styles.actionButtonCenter} onPress={onMessage}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButtonCenter, isLikeButtonLoading && styles.actionButtonLoading]} 
              onPress={onLike}
              disabled={isLikeButtonLoading}
            >
              {isLikeButtonLoading 
                ? <ActivityIndicator color="#fff" size="small"/> 
                : <FontAwesome5 name="heart" solid size={22} color="#fff" />} 
            </TouchableOpacity>
          )}
          
          <View style={styles.actionButtonPlaceholder} /> 
        </>
      )}
    </View>
  </>
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
// --- End Reusable Components ---

export default function UserProfilePage() {
  const { user: authUser, token } = useAuth(); 
  const router = useRouter();
  const { userId: userIdString } = useLocalSearchParams<{ userId: string }>();
  
  const viewedUserId = useMemo(() => {
    const id = parseInt(userIdString || '0', 10);
    return (isNaN(id) || id === 0) ? null : id;
  }, [userIdString]);

  const [profileData, setProfileData] = useState<UserDetailDTO | null>(null);
  // Interests are now part of UserDetailDTO
  // const [interests, setInterests] = useState<Interest[]>([]); 
  const [loading, setLoading] = useState(true); // Overall loading for profile details
  const [userPosts, setUserPosts] = useState<ApiPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isLikeButtonLoading, setIsLikeButtonLoading] = useState(false);
  const [hasMatched, setHasMatched] = useState(false); 
  // TODO: Need a robust way to get matchId. For now, assume it might come from swipe response or another source.
  const [matchIdForChat, setMatchIdForChat] = useState<number | string | null>(null); 

  const isCurrentUser = authUser?.userId === viewedUserId;

  const fetchProfileData = useCallback(async (idToFetch: number) => {
    if (!idToFetch) return;
    if (!idToFetch || !authUser?.userId) return;
    setLoading(true);
    setLoadingPosts(true); // Start loading posts
    try {
      // Fetch profile details and posts in parallel
      const [userDetails, posts] = await Promise.all([
        getUserDetailsById(idToFetch),
        getPosts(1, 10, idToFetch) // Fetch first 10 posts for this user
      ]);
      
      setProfileData(userDetails);
      setUserPosts(posts || []);

      // Check for existing match if not the current user
      if (authUser.userId !== idToFetch) {
        const previews = await getConversationPreviews();
        const existingMatch = previews.find(p => p.matchedUserID === idToFetch);
        if (existingMatch) {
          console.log(`UserProfilePage: Existing match found with ${idToFetch}, matchID: ${existingMatch.matchID}`);
          setHasMatched(true);
          setMatchIdForChat(existingMatch.matchID);
        } else {
          setHasMatched(false);
          setMatchIdForChat(null);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch profile data, posts, or match status for user:', idToFetch, error);
      Alert.alert('Error', 'Could not load complete profile data.');
    } finally {
      setLoading(false);
      setLoadingPosts(false); // Finish loading posts
    }
  }, [authUser?.userId]);

  useEffect(() => {
    if (viewedUserId && authUser?.userId) {
      fetchProfileData(viewedUserId);
    }
  }, [viewedUserId, authUser?.userId, fetchProfileData]); // fetchProfileData is memoized with authUser.userId

  const navigateToEditProfile = () => {
    if (isCurrentUser) router.push('/(setup)/edit-profile');
  };

  const handleLikeUser = async () => {
    if (!viewedUserId || isCurrentUser || !token) return;
    setIsLikeButtonLoading(true);
    try {
      const swipeData = { toUserID: viewedUserId, isLike: true };
      const response = await createSwipe(swipeData);
      Alert.alert("Swipe", response.message || (response.isMatch ? "It's a Match!" : "Liked!"));
      if (response.isMatch && viewedUserId) { // Ensure viewedUserId is not null
        // After a successful match, fetch updated conversation previews to get the correct matchID
        try {
          const previews = await getConversationPreviews();
          const newMatch = previews.find(p => p.matchedUserID === viewedUserId);
          if (newMatch) {
            console.log(`UserProfilePage: New match confirmed with ${viewedUserId}, matchID: ${newMatch.matchID}`);
            setHasMatched(true);
            setMatchIdForChat(newMatch.matchID);
          } else {
            // This case should be rare if createSwipe reported a match
            console.warn("UserProfilePage: createSwipe reported a match, but new matchID not found in conversation previews immediately.");
            // Fallback or error handling - perhaps use matchedWithUser.userId if absolutely necessary and chat screen can handle it
            // For now, we'll rely on finding it in previews. If not found, chat button might not work as expected.
            setHasMatched(true); // Still mark as matched based on createSwipe
            // setMatchIdForChat(response.matchedWithUser?.userId); // Potentially problematic
          }
        } catch (previewError) {
          console.error("UserProfilePage: Failed to fetch conversation previews after match:", previewError);
           // Fallback or error handling
           setHasMatched(true); // Still mark as matched
        }
      }
    } catch (error: any) {
      console.error("Failed to like user:", error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Could not process like.');
    } finally {
      setIsLikeButtonLoading(false);
    }
  };

  const handleNavigateToChat = () => {
    if (matchIdForChat) {
      router.push(`/(tabs)/chat/${matchIdForChat}`);
    } else {
      // This case should ideally be prevented by disabling/hiding the button
      // or by ensuring matchIdForChat is set when hasMatched is true.
      // One might need to fetch match details if navigating here directly and already matched.
      Alert.alert("Chat Unavailable", "Match details not found to start chat.");
      console.warn("Attempted to navigate to chat without a valid matchIdForChat.");
      // As a fallback, try to find if a match exists and get conversation ID
      // This would require an API like getMatchDetailsByUserId(viewedUserId)
    }
  };

  if (loading) return <View style={styles.centeredLoader}><ActivityIndicator size="large" color="#eb3c58" /></View>;
  if (!profileData) {
    return (
      <View style={styles.centeredLoader}>
        <Stack.Screen options={{ title: 'Profile Not Found' }} />
        <Text>User profile not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}><Text style={{ color: '#eb3c58' }}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }

  const age = calculateAge(profileData.birthdate);
  const displayNameAndAge = `${profileData.fullName || profileData.username}${age ? `, ${age}` : ''}`;
  const avatarSource = profileData.avatar 
    ? (profileData.avatar.startsWith('http') || profileData.avatar.startsWith('data:image') ? { uri: profileData.avatar } : { uri: `${API_BASE_URL}${profileData.avatar.startsWith('/') ? '' : '/'}${profileData.avatar}` })
    : require('../../../assets/images/dating-app.png');

  return (
    <>
      <Stack.Screen options={{ title: profileData.username || 'User Profile' }} />
      <ScrollView style={styles.container}>
        <ProfileHeader 
          avatarSource={avatarSource} 
          isCurrentUser={isCurrentUser}
          onEdit={navigateToEditProfile}
          onLike={handleLikeUser}
          onMessage={handleNavigateToChat}
          hasMatched={hasMatched}
          isLikeButtonLoading={isLikeButtonLoading}
        />
<View style={styles.profileDetails}>
  <View style={styles.nameAndLocationContainer}>
    <Text style={styles.name}>{displayNameAndAge}</Text>
    {/* Distance Display Logic with placeholder for missing data */}
    {!isCurrentUser && (() => { // Chỉ hiển thị nếu không phải là profile của chính mình
      const distance = profileData.distanceKm; // <-- LẤY DỮ LIỆU TỪ profileData
      // Chuyển đổi sang số một cách an toàn, xử lý cả null và undefined
      const numericDistance = (distance !== null && distance !== undefined) ? parseFloat(String(distance)) : NaN;

      if (!isNaN(numericDistance)) { // Kiểm tra xem có phải là một số hợp lệ không
        return (
          <View style={styles.locationContainer}>
            <FontAwesome5 name="map-marker-alt" size={14} color="gray" />
            <Text style={styles.locationText}>{numericDistance.toFixed(1)} km away</Text>
          </View>
        );
      } else if (profileData.address) { // Nếu không có khoảng cách nhưng có địa chỉ, hiển thị địa chỉ
          return (
            <View style={styles.locationContainer}>
              <FontAwesome5 name="map-marker-alt" size={14} color="gray" />
              <Text style={styles.locationText}>{profileData.address}</Text>
            </View>
          );
      } else { // Hiển thị placeholder nếu không có distanceKm và không có address
        return ( 
          <View style={styles.locationContainer}>
            <FontAwesome5 name="map-marker-alt" size={14} color="lightgray" />
            <Text style={[styles.locationText, { color: 'lightgray' }]}>Location not specified</Text> 
          </View>
        );
      }
    })()}
  </View>
          <Text style={styles.subtitle}>{profileData.bio || (isCurrentUser ? 'Add a bio to tell others about yourself!' : 'No bio yet.')}</Text>
          
          <ProfileSection title="About">
            <Text style={styles.aboutText}>{profileData.bio || (isCurrentUser ? 'Tap edit to add your bio.' : 'No information provided.')}</Text>
          </ProfileSection>

          {profileData.interests && profileData.interests.length > 0 && (
            <ProfileSection title="Interests">
              <View style={styles.interestsRow}>
                {profileData.interests.map((interest) => (
                  <InterestItem key={interest.interestId} name={interest.interestName} />
                ))}
              </View>
            </ProfileSection>
          )}

          {/* Posts Section */}
          <ProfileSection title="Posts">
            {loadingPosts ? (
              <ActivityIndicator size="small" color="#555" style={{marginTop: 10}} />
            ) : userPosts.length === 0 ? (
              <Text style={styles.noPostsText}>No posts yet.</Text>
            ) : (
              userPosts.map((post) => (
                <PostCard 
                  post={post} 
                  key={post.postID} 
                  // onCommentPress and onSharePress can be omitted for now,
                  // or implemented to navigate to post detail view first.
                  // PostCard's internal navigation should handle clicks on content/media.
                />
              ))
            )}
          </ProfileSection>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centeredLoader: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  headerImage: { 
    width: '100%', 
    height: 350, 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30, 
    backgroundColor: '#e0e0e0' 
  },
  actionRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center', 
    marginTop: -35, 
    paddingHorizontal: 20, 
    marginBottom: 25 
  },
  actionButton: { 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 30, 
    elevation: 6, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.27, 
    shadowRadius: 4.65 
  },
  actionButtonPlaceholder: { // For symmetry when one side button is not needed
    width: 52, // Approx (padding*2 + icon_size_approx) to match actionButton
    height: 52,
  },
  actionButtonCenter: { 
    backgroundColor: '#eb3c58', 
    padding: 24, 
    borderRadius: 35, 
    elevation: 8, 
    shadowColor: '#eb3c58', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 4.65,
    width: 70, // Ensure it's a circle
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonLoading: {
    backgroundColor: '#f08080', // Lighter red when loading
  },
  profileDetails: { paddingHorizontal: 20, paddingTop: 10 },
  nameAndLocationContainer: {
    alignItems: 'center', // Center name and location block
    marginBottom: 6,
  },
  name: { fontSize: 26, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: 'gray',
    marginLeft: 5,
  },
  subtitle: { fontSize: 16, color: 'gray', textAlign: 'center', marginBottom: 24 },
  sectionContainer: { marginBottom: 20 },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    color: '#444', 
    marginBottom: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    paddingBottom: 6 
  },
  aboutText: { fontSize: 15, color: '#555', lineHeight: 22 },
  interestsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  interest: { 
    backgroundColor: '#f0f0f0', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 18, 
    marginRight: 10, 
    marginBottom: 10 
  },
  interestText: { color: '#333', fontSize: 14 },
  noInterestsText: { color: '#777', fontStyle: 'italic' },
  // Styles for Posts section
  noPostsText: {
    textAlign: 'center',
    color: 'gray',
    marginTop: 10,
    fontStyle: 'italic',
  },
  postContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.00,
    elevation: 1,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#e0e0e0', // Placeholder
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 21,
    marginBottom: 8,
  },
  postTimestamp: {
    fontSize: 12,
    color: 'gray',
    textAlign: 'right',
  },
  // PostCard itself will have its own margins, so postContainer might not be needed
  // or can be adjusted if extra wrapping is desired.
  // For now, removing postContainer style as PostCard should handle its own layout.
});
