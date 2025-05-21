import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getAllInterests, saveUserInterests, Interest, UserInterestData } from '../../utils/api';

export default function HabitScreen() {
  const router = useRouter();
  const { user, logout } = useAuth(); // Destructure logout
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedInterestIds, setSelectedInterestIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchInterests = async () => {
      setLoading(true);
      try {
        const fetchedInterests = await getAllInterests();
        setInterests(fetchedInterests || []);
      } catch (error) {
        console.error('Failed to fetch interests:', error);
        Alert.alert('Error', 'Failed to load interests. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchInterests();
  }, []);

  const toggleInterestSelection = (interestId: number) => {
    setSelectedInterestIds((prevSelected) =>
      prevSelected.includes(interestId)
        ? prevSelected.filter((id) => id !== interestId)
        : [...prevSelected, interestId]
    );
  };

  const handleSaveInterests = async () => {
    if (!user || !user.userId) {
      Alert.alert('Error', 'User not found. Please log in again.');
      // Optionally navigate to login
      // router.replace('/(auth)/login_email'); 
      return;
    }

    if (selectedInterestIds.length === 0) {
      Alert.alert('Information', 'Please select at least one interest.');
      return;
    }

    setSaving(true);
    const dataToSave: UserInterestData = {
      userId: user.userId,
      interestIds: selectedInterestIds,
    };

    try {
      await saveUserInterests(dataToSave);
      Alert.alert(
        'Success',
        'Your interests have been saved!',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/explore') }]
      );
    } catch (error: any) {
      console.error('Failed to save interests:', error);
      if (error.response?.status === 401) { // Unauthorized or token expired
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again.',
          [{ text: 'OK', onPress: () => logout() }] // Call logout on OK
        );
      } else {
        Alert.alert('Error', error.response?.data?.message || 'Failed to save interests. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#EB3C58" />
        <Text style={styles.loadingText}>Loading interests...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Select Your Interests</Text>
      <Text style={styles.subtitle}>Choose a few things you're passionate about.</Text>

      {interests.length === 0 && !loading && (
        <Text style={styles.noInterestsText}>No interests available at the moment. Please try again later.</Text>
      )}

      <View style={styles.interestsContainer}>
        {interests.map((interest) => (
          <TouchableOpacity
            key={interest.interestId}
            style={[
              styles.interestChip,
              selectedInterestIds.includes(interest.interestId) && styles.interestChipSelected,
            ]}
            onPress={() => toggleInterestSelection(interest.interestId)}
            disabled={saving}
          >
            <Text
              style={[
                styles.interestChipText,
                selectedInterestIds.includes(interest.interestId) && styles.interestChipTextSelected,
              ]}
            >
              {interest.interestName}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, (saving || selectedInterestIds.length === 0) && styles.buttonDisabled]}
        onPress={handleSaveInterests}
        disabled={saving || selectedInterestIds.length === 0}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 32,
    width: '100%',
  },
  interestChip: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    margin: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  interestChipSelected: {
    backgroundColor: '#EB3C58',
    borderColor: '#EB3C58',
  },
  interestChipText: {
    color: '#333',
    fontSize: 15,
  },
  interestChipTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#EB3C58',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 350, 
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  noInterestsText: {
    textAlign: 'center',
    color: '#777',
    fontSize: 16,
    marginTop: 20,
  }
});
