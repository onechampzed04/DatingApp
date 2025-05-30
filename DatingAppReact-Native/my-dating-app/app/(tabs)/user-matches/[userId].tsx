import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, getUserById, ApiUser, getConversationPreviews, ConversationPreviewDTO } from '../../../utils/api';
import { useAuth } from '../../context/AuthContext'; // Corrected path

// Using ConversationPreviewDTO to shape the display item for matched users
interface MatchedUserDisplayItem {
  id: number; // This will be matchedUserID from ConversationPreviewDTO
  fullName: string | null;
  avatar: string | null;
}

// Placeholder API function for fetching other users' matches (if ever implemented)
// const getMatchesForOtherUserAPI = async (userId: number): Promise<MatchedUserDisplayItem[]> => {
//   console.log(`[UserMatchesScreen] Fetching matches for OTHER user ID: ${userId}`);
//   // This would be an actual API call to something like /api/Users/${userId}/matches
//   await new Promise(resolve => setTimeout(resolve, 1000));
//   return []; 
// };


const UserMatchesScreen = () => {
  const router = useRouter();
  const { user: loggedInUser } = useAuth();
  const params = useLocalSearchParams<{ userId: string }>();
  const viewedUserId = params.userId ? parseInt(params.userId, 10) : null;

  const [profileUser, setProfileUser] = useState<ApiUser | null>(null); // The user whose profile matches are being viewed
  const [matches, setMatches] = useState<MatchedUserDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwnProfileView, setIsOwnProfileView] = useState(false);

  const fetchUserDataAndMatches = useCallback(async () => {
    if (!viewedUserId) {
      setError('User ID is missing.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    const ownProfileCheck = viewedUserId === loggedInUser?.userId;
    setIsOwnProfileView(ownProfileCheck);

    try {
      const userWhoseProfileIsViewed = await getUserById(viewedUserId);
      setProfileUser(userWhoseProfileIsViewed);

      if (ownProfileCheck) {
        console.log(`[UserMatchesScreen] Fetching own matches for user ID: ${viewedUserId}`);
        const conversationPreviews = await getConversationPreviews();
        const formattedMatches: MatchedUserDisplayItem[] = conversationPreviews.map(cp => ({
          id: cp.matchedUserID,
          fullName: cp.matchedUsername || null, // Ensure null if undefined
          avatar: cp.matchedUserAvatar || null,   // Ensure null if undefined
        }));
        setMatches(formattedMatches);
      } else {
        console.log(`[UserMatchesScreen] Attempting to view matches for other user ID: ${viewedUserId}. API for this is not available.`);
        setMatches([]); // Keep matches empty, UI will show specific message
      }
    } catch (err: any) {
      console.error('Failed to fetch user data or matches:', err);
      setError(err.message || 'Could not load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [viewedUserId, loggedInUser?.userId]);

  useEffect(() => {
    fetchUserDataAndMatches();
  }, [fetchUserDataAndMatches]);

  const renderMatchItem = ({ item }: { item: MatchedUserDisplayItem }) => {
    const avatarSource = item.avatar
      ? { uri: item.avatar.startsWith('http') ? item.avatar : `${API_BASE_URL}${item.avatar}` }
      : require('../../../assets/images/dating-app.png'); // Fallback avatar

    return (
      <TouchableOpacity 
        style={styles.matchItem} 
        onPress={() => router.push(`/(tabs)/user-profile/${item.id}`)}
      >
        <Image source={avatarSource} style={styles.avatar} />
        <Text style={styles.matchName}>{item.fullName || `User ${item.id}`}</Text>
        {/* Add more details if needed, e.g., common interests, age */}
      </TouchableOpacity>
    );
  };

  if (!viewedUserId) {
    return (
      <View style={styles.centeredMessage}>
        <Text>Invalid User ID.</Text>
      </View>
    );
  }
  
  const screenTitle = profileUser ? `Matches for ${profileUser.fullName || profileUser.username}` : "User's Matches";

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: screenTitle }} />
      {isLoading ? (
        <ActivityIndicator size="large" color="#eb3c58" style={styles.loader} />
      ) : error ? (
        <View style={styles.centeredMessage}>
          <Ionicons name="alert-circle-outline" size={50} color="#777" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !isOwnProfileView && matches.length === 0 && !error ? (
        // Special message for viewing other's matches when API is not available
        <View style={styles.centeredMessage}>
          <Ionicons name="lock-closed-outline" size={50} color="#ccc" />
          <Text style={styles.noMatchesText}>
            Viewing other users' specific match lists is not currently available.
          </Text>
          <Text style={styles.placeholderText}>
            This feature requires a specific API endpoint.
          </Text>
        </View>
      ) : matches.length === 0 ? (
        // Message for no matches (either own profile or if API for others somehow returned empty)
        <View style={styles.centeredMessage}>
          <Ionicons name="people-outline" size={50} color="#ccc" />
          <Text style={styles.noMatchesText}>
            {profileUser?.fullName || 'This user'} has no matches yet.
          </Text>
          {isOwnProfileView && (
            <Text style={styles.placeholderText}>Time to start swiping!</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatchItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContentContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loader: {
    marginTop: 50,
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
  },
  noMatchesText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 10,
  },
  placeholderText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  listContentContainer: {
    paddingVertical: 10,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: '#e0e0e0',
  },
  matchName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
});

export default UserMatchesScreen;
