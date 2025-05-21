import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Button,
  StyleSheet,Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getUserById, getUserInterests, ApiUser, Interest } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Calculate age based on birthdate
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

// Reusable ProfileHeader component
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

// Reusable ProfileSection component
const ProfileSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

// InterestItem component
const InterestItem = ({ name }: { name: string }) => (
  <View style={styles.interest}>
    <Text style={styles.interestText}>{name}</Text>
  </View>
);

const UserProfileScreen = () => {
  const { user: authUser, logout } = useAuth();
  const router = useRouter();
  const [profileState, setProfileState] = useState<{ userData: ApiUser | null; interests: Interest[]; loading: boolean; userId: number | null }>({
    userData: null,
    interests: [],
    loading: true,
    userId: null,
  });

  const fetchProfileData = useCallback(async (userId: number) => {
    setProfileState((prev) => ({ ...prev, loading: true }));
    try {
      const [profile, interests] = await Promise.all([getUserById(userId), getUserInterests(userId)]);
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

  useEffect(() => {
    const fetchUserId = async () => {
      let idToFetch: number | null = null;
      if (authUser?.userId) {
        idToFetch = authUser.userId;
      } else {
        const userIdStr = await AsyncStorage.getItem('userId');
        if (userIdStr) {
          idToFetch = parseInt(userIdStr, 10);
        }
      }
      setProfileState((prev) => ({ ...prev, userId: idToFetch }));
      if (!idToFetch) {
        Alert.alert('Error', 'User not identified. Please log in.', [{ text: 'OK', onPress: logout }]);
        setProfileState((prev) => ({ ...prev, loading: false }));
      }
    };
    fetchUserId();
  }, [authUser, logout]);

  useFocusEffect(
    useCallback(() => {
      if (profileState.userId) {
        console.log(`Fetching data for user ID: ${profileState.userId} on focus`);
        fetchProfileData(profileState.userId);
      }
    }, [profileState.userId, fetchProfileData])
  );

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const navigateToEditProfile = () => router.push('/(setup)/edit-profile');
  const navigateToFriendList = () => router.push('/(tabs)/interaction/friend-list');

  const { loading, userData, interests, userId } = profileState;
  if (loading) {
    return (
      <View style={styles.centeredLoader}>
        <ActivityIndicator size="large" color="#eb3c58" />
      </View>
    );
  }

  if (!userData || !userId) {
    return (
      <View style={styles.centeredLoader}>
        <Text>Could not load user profile. Please try again.</Text>
      </View>
    );
  }

  const age = calculateAge(userData.birthdate);
  const displayNameAndAge = `${userData.fullName || userData.username || ''}${age ? `, ${age}` : ''}`;
  const avatarSource = userData.avatar
    ? { uri: userData.avatar.startsWith('data:image') ? userData.avatar : `data:image/jpeg;base64,${userData.avatar}` }
    : require('../../assets/images/dating-app.png');

  return (
    <ScrollView style={styles.container}>
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
        <View style={styles.logoutContainer}>
          <Button title="Đăng xuất" onPress={handleLogout} color="#eb3c58" />
        </View>
      </View>
    </ScrollView>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  logoutContainer: {
    marginTop: 40,
    marginBottom: 50,
    alignItems: 'center',
  },
});