// app/(tabs)/chat/user-profile/[userId].tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getUserById, ApiUser, API_BASE_URL } from '../../../utils/api'; // Điều chỉnh đường dẫn nếu cần
// Giả sử bạn sẽ lưu trữ theme theo matchId trong AsyncStorage hoặc một context/DB
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_AVATAR_PROFILE = 'https://via.placeholder.com/100'; // Avatar lớn hơn cho profile

interface ThemeOption {
  id: string;
  name: string;
  gradientColors: string[];
  textColor: string;
  myMessageBubbleColor?: string; // Tùy chọn màu bubble của mình
  otherMessageBubbleColor?: string; // Tùy chọn màu bubble của đối phương
}

// Danh sách các theme mặc định
const defaultThemes: ThemeOption[] = [
  { id: 'default', name: 'Default', gradientColors: ['#F4F4F8', '#EAEAF8'], textColor: '#000000', myMessageBubbleColor: '#EA405A', otherMessageBubbleColor: '#E9E9EB' },
  { id: 'ocean', name: 'Ocean Blue', gradientColors: ['#2193b0', '#6dd5ed'], textColor: '#FFFFFF', myMessageBubbleColor: '#0B486B', otherMessageBubbleColor: '#3B8686' },
  { id: 'sunset', name: 'Sunset Orange', gradientColors: ['#ff7e5f', '#feb47b'], textColor: '#FFFFFF', myMessageBubbleColor: '#D35400', otherMessageBubbleColor: '#F39C12'  },
  { id: 'forest', name: 'Forest Green', gradientColors: ['#5A3F37', '#2C7744'], textColor: '#FFFFFF', myMessageBubbleColor: '#1E4620', otherMessageBubbleColor: '#4A5D23'  },
  { id: 'lavender', name: 'Lavender Bliss', gradientColors: ['#B2A4FF', '#D6D2FF'], textColor: '#332E5E', myMessageBubbleColor: '#6046FF', otherMessageBubbleColor: '#E1DDFF'  },
  // Thêm các theme khác ở đây
];

// Key để lưu theme trong AsyncStorage, sử dụng matchId
const getThemeStorageKey = (matchId: string) => `chatTheme_match_${matchId}`;

export default function MatchedUserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string; matchId: string }>();
  const userId = params.userId ? parseInt(params.userId, 10) : undefined;
  const matchId = params.matchId; // matchId này sẽ được dùng để lưu theme

  const [matchedUser, setMatchedUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('default');

  useEffect(() => {
    const fetchUserDataAndTheme = async () => {
      if (userId) {
        setLoading(true);
        try {
          const userData = await getUserById(userId);
          setMatchedUser(userData);
        } catch (error) {
          console.error("Failed to fetch matched user details:", error);
          Alert.alert("Error", "Could not load user details.");
        }
      }

      if (matchId) {
        try {
          const storedThemeId = await AsyncStorage.getItem(getThemeStorageKey(matchId));
          if (storedThemeId) {
            setSelectedThemeId(storedThemeId);
          }
        } catch (error) {
          console.error("Failed to load theme:", error);
        }
      }
      setLoading(false);
    };

    fetchUserDataAndTheme();
  }, [userId, matchId]);

  const handleThemeSelect = async (themeId: string) => {
    if (!matchId) return;
    setSelectedThemeId(themeId);
    try {
      await AsyncStorage.setItem(getThemeStorageKey(matchId), themeId);
      Alert.alert("Theme Changed", `Chat theme set to ${defaultThemes.find(t => t.id === themeId)?.name || 'selected theme'}.`);
      // Có thể bạn muốn router.back() hoặc thông báo cho ChatScreen cập nhật theme ngay lập tức
      // Ví dụ: Dùng một event bus hoặc cập nhật một global state/context
    } catch (error) {
      console.error("Failed to save theme:", error);
      Alert.alert("Error", "Could not save theme preference.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#EA405A" />
      </View>
    );
  }

  if (!userId || !matchId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>User ID or Match ID is missing.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.button}>
            <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userAvatar = matchedUser?.avatar
    ? (matchedUser.avatar.startsWith('http') ? matchedUser.avatar : `${API_BASE_URL}${matchedUser.avatar}`)
    : DEFAULT_AVATAR_PROFILE;

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: matchedUser?.fullName || matchedUser?.username || 'User Profile' }} />

      <View style={styles.profileHeader}>
        <Image source={{ uri: userAvatar }} style={styles.profileAvatar} />
        <Text style={styles.profileName}>{matchedUser?.fullName || matchedUser?.username || 'N/A'}</Text>
        <Text style={styles.profileBio}>{matchedUser?.bio || 'No bio available.'}</Text>
        {/* Thêm các thông tin khác của user nếu muốn: tuổi, giới tính, địa chỉ,... */}
        {matchedUser?.email && <Text style={styles.profileDetail}>Email: {matchedUser.email}</Text>}
        {/* ... thêm thông tin khác ... */}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chat Theme</Text>
        <Text style={styles.sectionSubtitle}>Personalize your chat experience for this conversation.</Text>
        {defaultThemes.map((theme) => (
          <TouchableOpacity
            key={theme.id}
            style={[
              styles.themeOption,
              selectedThemeId === theme.id && styles.selectedThemeOption,
            ]}
            onPress={() => handleThemeSelect(theme.id)}
          >
            <View style={[styles.themePreview, {
                // Tạo preview gradient cho theme
                // backgroundColor: theme.gradientColors[0], // fallback
            }]}>
                <View style={{flex: 1, backgroundColor: theme.gradientColors[0]}} />
                <View style={{flex: 1, backgroundColor: theme.gradientColors[1]}} />
            </View>
            <Text style={[styles.themeName, selectedThemeId === theme.id && styles.selectedThemeName]}>{theme.name}</Text>
            {selectedThemeId === theme.id && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" style={styles.checkmarkIcon} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Các mục cài đặt khác nếu có */}
      {/*
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert("Block User", "Feature not implemented yet.")}>
            <Ionicons name="ban-outline" size={20} color="#D32F2F" />
            <Text style={[styles.actionButtonText, {color: "#D32F2F"}]}>Block {matchedUser?.username || 'User'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert("Report User", "Feature not implemented yet.")}>
            <Ionicons name="flag-outline" size={20} color="#FFA000" />
            <Text style={[styles.actionButtonText, {color: "#FFA000"}]}>Report {matchedUser?.username || 'User'}</Text>
        </TouchableOpacity>
      </View>
      */}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 10,
  },
  profileAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: '#EA405A',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  profileBio: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 10,
  },
  profileDetail: {
    fontSize: 14,
    color: '#444',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#777',
    marginBottom: 20,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFF'
  },
  selectedThemeOption: {
    borderColor: '#EA405A',
    backgroundColor: '#FFF8F9',
    borderWidth: 2,
  },
  themePreview: {
    width: 40,
    height: 40,
    borderRadius: 20, // Hình tròn
    marginRight: 15,
    flexDirection: 'row', // Để hiển thị 2 màu gradient (đơn giản)
    overflow: 'hidden', // Cần thiết cho borderRadius
    borderWidth: 1,
    borderColor: '#CCC'
  },
  themeName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  selectedThemeName: {
    fontWeight: 'bold',
    color: '#EA405A',
  },
  checkmarkIcon: {
    marginLeft: 10,
  },
  button: {
    backgroundColor: '#EA405A',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  actionButtonText: {
    marginLeft: 15,
    fontSize: 16,
  }
});
