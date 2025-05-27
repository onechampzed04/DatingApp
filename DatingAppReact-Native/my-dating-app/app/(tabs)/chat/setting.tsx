import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function ChatSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId?: string; matchedUserId?: string }>();
  const { matchId, matchedUserId } = params;

  if (!matchId || !matchedUserId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing required parameters.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleChangeTheme = () => {
    router.push({
      pathname: '/(tabs)/user-profile/[userId]',
      params: { userId: matchedUserId, matchId: matchId, openThemeSettings: 'true' }, // Pass a param to directly open theme settings if needed
    });
  };

  const handleViewProfile = () => {
    router.push({
      pathname: '/(tabs)/user-profile/[userId]',
      params: { userId: matchedUserId, matchId: matchId },
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Chat Settings' }} />

      <View style={styles.section}>
        <TouchableOpacity style={styles.optionButton} onPress={handleChangeTheme}>
          <Ionicons name="color-palette-outline" size={24} color="#EA405A" style={styles.optionIcon} />
          <Text style={styles.optionText}>Change Chat Theme</Text>
          <Ionicons name="chevron-forward" size={22} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionButton} onPress={handleViewProfile}>
          <Ionicons name="person-circle-outline" size={24} color="#EA405A" style={styles.optionIcon} />
          <Text style={styles.optionText}>View User Profile</Text>
          <Ionicons name="chevron-forward" size={22} color="#C7C7CC" />
        </TouchableOpacity>
      </View>
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
  button: {
    backgroundColor: '#EA405A',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#C8C7CC',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#C8C7CC',
  },
  optionIcon: {
    marginRight: 15,
  },
  optionText: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
  },
});
