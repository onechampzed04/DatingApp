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
import { Ionicons } from '@expo/vector-icons'; // For back button
import { useAuth } from '../../context/AuthContext'; // Adjusted path
import { getUserById, getUserInterests, ApiUser, Interest, API_BASE_URL } from '../../../utils/api'; // Adjusted path

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
  onEdit, // Only if isCurrentUser
  // Add other actions as needed (e.g., Message, Add Friend)
}: { 
  avatarSource: any; 
  isCurrentUser: boolean;
  onEdit?: () => void; 
}) => (
  <>
    <Image source={avatarSource} style={styles.headerImage} />
    <View style={styles.actionRow}>
      {isCurrentUser ? (
        <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
          {/* Replace with a more appropriate icon for edit, e.g., a pencil */}
          <Ionicons name="pencil-outline" size={22} color="#333" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert("Follow", "Follow action TBD")}>
           <Ionicons name="person-add-outline" size={22} color="#333" />
        </TouchableOpacity>
      )}
      
      <TouchableOpacity style={styles.actionButtonCenter} onPress={() => Alert.alert("Main Action", "Main profile action TBD")}>
         {/* This center button could be 'Message' for other users, or something else */}
        <Ionicons name={isCurrentUser ? "sparkles-outline" : "chatbubble-ellipses-outline"} size={26} color="#fff" />
      </TouchableOpacity>

      {isCurrentUser ? (
         <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert("Settings", "Settings TBD")}>
          <Ionicons name="settings-outline" size={22} color="#333" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert("More Actions", "More actions TBD")}>
            <Ionicons name="ellipsis-horizontal-outline" size={22} color="#333" />
        </TouchableOpacity>
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
  const { user: authUser } = useAuth(); // To check if the profile being viewed is the current user
  const router = useRouter();
  const { userId: userIdString } = useLocalSearchParams<{ userId: string }>();
  
  // Memoize parsed userId to ensure stability for useEffect dependencies
  const viewedUserId = useMemo(() => {
    const id = parseInt(userIdString || '0', 10);
    if (isNaN(id) || id === 0) {
      console.error("Invalid or missing userId in route params:", userIdString);
      return null; 
    }
    return id;
  }, [userIdString]);

  const [profileData, setProfileData] = useState<ApiUser | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);

  const isCurrentUser = authUser?.userId === viewedUserId;

  const fetchProfileData = useCallback(async (idToFetch: number) => {
    if (!idToFetch) return; // Should not happen if viewedUserId is validated
    setLoading(true);
    try {
      // console.log(`Fetching profile for User ID: ${idToFetch}`);
      const [profile, userInterests] = await Promise.all([
        getUserById(idToFetch),
        getUserInterests(idToFetch),
      ]);
      setProfileData(profile);
      setInterests(userInterests || []);
    } catch (error: any) {
      console.error('Failed to fetch profile data for user:', idToFetch, error);
      Alert.alert('Error', 'Could not load profile data.');
      // Optionally navigate back if profile fails to load critically
      // if (router.canGoBack()) router.back();
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies that change frequently here

  useEffect(() => {
    if (viewedUserId) {
      fetchProfileData(viewedUserId);
    } else if (userIdString === undefined) { // Handle case where param might not be ready
        // This might indicate an issue with navigation or param passing
        // console.log("UserProfilePage: userIdString is undefined, waiting or error.")
    }
  }, [viewedUserId, fetchProfileData]); // Depend on stable viewedUserId and memoized fetchProfileData

  const navigateToEditProfile = () => {
    if (isCurrentUser) {
      router.push('/(setup)/edit-profile'); // Path to edit profile screen
    }
  };
  
  if (loading) {
    return (
      <View style={styles.centeredLoader}>
        <ActivityIndicator size="large" color="#eb3c58" />
      </View>
    );
  }

  if (!profileData) {
    return (
      <View style={styles.centeredLoader}>
        {/* Add Stack.Screen here for the back button even on error */}
        <Stack.Screen options={{ title: 'Profile Not Found', headerBackTitle: '' }} />
        <Text>User profile not found or could not be loaded.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: '#eb3c58' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // If profileData is available, proceed to render
  const age = calculateAge(profileData.birthdate);
  const displayNameAndAge = `${profileData.fullName || profileData.username}${age ? `, ${age}` : ''}`;
  
  let finalAvatarUri: string | null = null;
  if (profileData.avatar) {
    if (profileData.avatar.startsWith('http://') || profileData.avatar.startsWith('https://') || profileData.avatar.startsWith('data:image')) {
      finalAvatarUri = profileData.avatar;
    } else {
      finalAvatarUri = `${API_BASE_URL}${profileData.avatar.startsWith('/') ? '' : '/'}${profileData.avatar}`;
    }
  }
  const avatarSource = finalAvatarUri
    ? { uri: finalAvatarUri }
    : require('../../../assets/images/dating-app.png'); // Adjusted path

  return (
    <>
    {/* Configure Header */}
     <Stack.Screen 
        options={{ 
            title: profileData.username || 'User Profile', // Set a dynamic title
            headerBackTitle: '', // Hide "Back" text on iOS if desired
            // headerTransparent: true, // If you want the image to go under the header
            // headerTintColor: '#fff', // If transparent, make sure back button is visible
        }} 
     />
    <ScrollView style={styles.container}>
      <ProfileHeader 
        avatarSource={avatarSource} 
        isCurrentUser={isCurrentUser}
        onEdit={isCurrentUser ? navigateToEditProfile : undefined}
      />
      <View style={styles.profileDetails}>
        <Text style={styles.name}>{displayNameAndAge}</Text>
        <Text style={styles.subtitle}>{profileData.bio || 'No bio yet.'}</Text>
        
        <ProfileSection title="About">
          <Text style={styles.aboutText}>{profileData.bio || 'No information provided.'}</Text>
        </ProfileSection>

        {interests.length > 0 && (
          <ProfileSection title="Interests">
            <View style={styles.interestsRow}>
              {interests.map((interest) => (
                <InterestItem key={interest.interestId} name={interest.interestName} />
              ))}
            </View>
          </ProfileSection>
        )}
        {/* Add other sections like Photos, Posts by this user etc. */}
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerImage: {
    width: '100%',
    height: 350, // Or Dimensions.get('window').height * 0.4
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#e0e0e0', // Placeholder color
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: -35, // Negative margin to overlay on the image
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 16, // Slightly larger for easier tap
    borderRadius: 30, // Circular
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  actionButtonCenter: {
    backgroundColor: '#eb3c58', // Primary color
    padding: 24, // Largest button
    borderRadius: 35, // Circular
    elevation: 8,
    shadowColor: '#eb3c58', // Shadow matches button color for a glow effect
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 4.65,
  },
  profileDetails: {
    paddingHorizontal: 20,
    paddingTop: 10, // Space from action buttons
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
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#444',
    // marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 6,
  },
  aboutText: {
    fontSize: 15, // Adjusted for readability
    color: '#555',
    lineHeight: 22, // For better paragraph spacing
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // marginBottom: 20, // No, margin handled by sectionContainer
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
    fontSize: 14, // Slightly smaller
  },
  noInterestsText: { // If you add a placeholder for no interests
    color: '#777',
    fontStyle: 'italic',
  },
});
