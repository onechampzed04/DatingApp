// app/(tabs)/chat/settings.tsx (or your existing path for ChatSettingsScreen)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getUserById, ApiUser, API_BASE_URL } from '../../../utils/api'; // Adjust path as needed
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_AVATAR_CHAT_SETTINGS = require('../../../assets/images/dating-app.png'); // Path to your fallback avatar for chat settings

interface ThemeOption {
  id: string;
  name: string;
  gradientColors: string[]; // For chat background
  previewBubbleColor?: string; // A representative color for theme preview
  // You can add more specific colors for myMessage, otherMessage bubbles if themes control them
}

// Define your themes (can be imported from a shared constants file)
const chatThemes: ThemeOption[] = [
  { id: 'default', name: 'Mặc định', gradientColors: ['#FFFFFF', '#F5F5F5'], previewBubbleColor: '#EA405A'},
  { id: 'ocean', name: 'Đại dương', gradientColors: ['#2193b0', '#6dd5ed'], previewBubbleColor: '#6dd5ed' },
  { id: 'sunset', name: 'Hoàng hôn', gradientColors: ['#ff7e5f', '#feb47b'], previewBubbleColor: '#feb47b' },
  { id: 'forest', name: 'Rừng xanh', gradientColors: ['#5A3F37', '#2C7744'], previewBubbleColor: '#2C7744' },
  { id: 'lavender', name: 'Oải hương', gradientColors: ['#B2A4FF', '#D6D2FF'], previewBubbleColor: '#D6D2FF' },
  { id: 'classic', name: 'Cổ điển (Facebook)', gradientColors: ['#0084FF', '#0084FF'], previewBubbleColor: '#0084FF'} // Example, solid color
];

const getThemeStorageKey = (matchId: string) => `chatTheme_match_${matchId}`;

export default function ChatSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    matchId?: string; 
    matchedUserId?: string; 
    matchedUserName?: string; // Already passed from MessagesScreen
    matchedUserAvatar?: string; // Already passed from MessagesScreen
  }>();
  
  const matchId = params.matchId;
  const matchedUserId = useMemo(() => params.matchedUserId ? parseInt(params.matchedUserId, 10) : undefined, [params.matchedUserId]);
  const initialMatchedUserName = params.matchedUserName;
  const initialMatchedUserAvatar = params.matchedUserAvatar;


  const [matchedUserData, setMatchedUserData] = useState<ApiUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true); // For fetching user data if not fully provided
  const [selectedThemeId, setSelectedThemeId] = useState<string>('default');
  const [savingTheme, setSavingTheme] = useState(false);

  // Fetch more detailed user data if only ID was passed, or use provided basic data
  useEffect(() => {
    const fetchFullUserDataAndTheme = async () => {
      setLoadingUser(true);
      if (matchedUserId) {
        try {
          const userData = await getUserById(matchedUserId);
          setMatchedUserData(userData);
        } catch (error) {
          console.error("Failed to fetch matched user details for settings:", error);
          // Keep initial name/avatar if fetch fails
        }
      }

      if (matchId) {
        try {
          const storedThemeId = await AsyncStorage.getItem(getThemeStorageKey(matchId));
          if (storedThemeId && chatThemes.find(t => t.id === storedThemeId)) {
            setSelectedThemeId(storedThemeId);
          }
        } catch (error) {
          console.error("Failed to load theme for settings:", error);
        }
      }
      setLoadingUser(false);
    };

    fetchFullUserDataAndTheme();
  }, [matchedUserId, matchId]);

  const handleThemeSelect = async (themeId: string) => {
    if (!matchId || savingTheme) return;
    setSavingTheme(true);
    const oldThemeId = selectedThemeId;
    setSelectedThemeId(themeId); // Optimistic update

    try {
      await AsyncStorage.setItem(getThemeStorageKey(matchId), themeId);
      // Consider using a global state/context or event emitter to notify ChatScreen immediately
      // Alert.alert("Theme Changed", `Theme set to ${chatThemes.find(t => t.id === themeId)?.name}.`);
    } catch (error) {
      console.error("Failed to save theme:", error);
      setSelectedThemeId(oldThemeId); // Revert on error
      Alert.alert("Error", "Could not save theme preference.");
    } finally {
      setSavingTheme(false);
    }
  };

  const handleViewProfile = () => {
    if (matchedUserId) {
      router.push({
        pathname: `../user-profile/${matchedUserId}`, // Navigate to the generic user profile screen
      });
    } else {
        Alert.alert("Error", "User ID not available to view profile.");
    }
  };
  
  const currentUserName = matchedUserData?.fullName || matchedUserData?.username || initialMatchedUserName || 'User';
  let currentUserAvatarUri = initialMatchedUserAvatar; // Use avatar passed in params first
  if (matchedUserData?.avatar) { // Then override with more detailed avatar if fetched
    currentUserAvatarUri = matchedUserData.avatar.startsWith('http') ? matchedUserData.avatar : `${API_BASE_URL}${matchedUserData.avatar}`;
  }


  if (!matchId || !matchedUserId) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Chat Settings' }} />
        <Text style={styles.errorText}>Missing required chat parameters.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (loadingUser && !initialMatchedUserName) { // Show loader only if absolutely no user info is present
     return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Loading Settings...' }} />
        <ActivityIndicator size="large" color="#EA405A" />
      </View>
    );
  }


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      <Stack.Screen options={{ title: 'Tùy chỉnh chat' }} />

      {/* Profile Header Section */}
      <View style={styles.profileHeaderSection}>
        <Image 
          source={currentUserAvatarUri ? { uri: currentUserAvatarUri } : DEFAULT_AVATAR_CHAT_SETTINGS} 
          style={styles.profileAvatar} 
        />
        <Text style={styles.profileName}>{currentUserName}</Text>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionButton} onPress={handleViewProfile}>
            <View style={styles.quickActionIconCircle}>
                <Ionicons name="person-outline" size={20} color="#000" />
            </View>
            <Text style={styles.quickActionText}>Trang cá nhân</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Customize Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tùy chỉnh</Text>
        {/* Theme Option -  No Chevron, direct list */}
        <View style={styles.optionRow}>
          <Ionicons name="color-palette-outline" size={24} color="#555" style={styles.optionIconLeading} />
          <Text style={styles.optionLabel}>Chủ đề</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeSelectorContainer}>
          {chatThemes.map((theme) => (
            <TouchableOpacity
              key={theme.id}
              style={[
                styles.themePreviewButton,
                selectedThemeId === theme.id && styles.selectedThemePreviewButton,
              ]}
              onPress={() => handleThemeSelect(theme.id)}
              disabled={savingTheme}
            >
              <View 
                style={[
                    styles.themeColorBubble, 
                    { backgroundColor: theme.previewBubbleColor || theme.gradientColors[0] }
                ]}
              />
              {/* <Text style={styles.themePreviewName}>{theme.name}</Text> */}
               {selectedThemeId === theme.id && (
                 <View style={styles.selectedCheckmarkContainer}>
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                 </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5', // Light gray background like Messenger settings
  },
  scrollContentContainer: {
    paddingBottom: 30,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0F2F5',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: { /* For Go Back button on error screen */
    backgroundColor: '#EA405A',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  // Profile Header
  profileHeaderSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF', // White background for this section
    marginBottom: 8, // Small space before next section
  },
  profileAvatar: {
    width: 80, // Standard avatar size
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Or space-evenly
    width: '80%', // Occupy decent width
  },
  quickActionButton: {
    alignItems: 'center',
    padding:10,
  },
  quickActionIconCircle: {
    backgroundColor: '#E4E6EB', // Light gray circle like Messenger
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  quickActionText: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
  },
  // General Section Styling
  section: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8, // Top/bottom padding for the section box
  },
  sectionTitle: {
    fontSize: 13, // Smaller, subdued title like Messenger
    fontWeight: '600',
    color: '#65676B', // Dark gray
    paddingHorizontal: 16,
    paddingTop: 8, // Give a bit of space if first element
    marginBottom: 8,
  },
  // Option Row (for items like "Quick Emoji", "Nickname")
  optionRow: { // For non-clickable rows like "Theme" label
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 50, // Consistent row height
  },
  optionRowButton: { // For clickable rows
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 50, // Consistent row height
    backgroundColor: '#FFFFFF', // Ensure clickable area is distinct
  },
  optionIconLeading: {
    marginRight: 16,
    width: 28, // Fixed width for icon alignment
    textAlign: 'center',
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#050505', // Almost black
  },
  // Theme Selector
  themeSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 5, // Space after horizontal scroll
  },
  themePreviewButton: {
    marginRight: 12,
    alignItems: 'center', // Center the color bubble
    padding: 4, // Padding to show selection border clearly
    borderRadius: 30, // Make it slightly larger than bubble for border
    borderWidth: 2,
    borderColor: 'transparent', // Default no border
  },
  selectedThemePreviewButton: {
    borderColor: '#007AFF', // Blue border for selection like iOS
  },
  themeColorBubble: {
    width: 36, // Consistent size for theme bubbles
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5, // Subtle border on the bubble itself
    borderColor: 'rgba(0,0,0,0.1)',
  },
  selectedCheckmarkContainer: {
    position: 'absolute',
    width: 40, // Must match themePreviewButton padding + bubble size
    height: 40,
    borderRadius:20,
    backgroundColor: 'rgba(0, 122, 255, 0.6)', // Semi-transparent blue overlay
    justifyContent: 'center',
    alignItems: 'center',
  },
  // themePreviewName: { // Optional name below bubble
  //   fontSize: 10,
  //   color: '#65676B',
  //   marginTop: 4,
  // },
});
