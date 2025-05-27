// app/_layout.tsx
import { useEffect } from 'react';
import { Slot, useRouter, useSegments, Stack } from 'expo-router'; // <--- IMPORT Stack HERE
import { AuthProvider, useAuth } from '../app/context/AuthContext'; // Corrected path assuming context is one level up
import { ChatProvider } from './context/ChatContext';      // Corrected path
import { View, ActivityIndicator, Text } from 'react-native';

function ProtectedLayout() {
  const { token, isLoading, user } = useAuth(); // Get user if it contains userId
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [token, segments, router, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#EB3C58" />
        <Text>Initializing App...</Text>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ChatProvider>
        <ProtectedLayout />
      </ChatProvider>
    </AuthProvider>
  );
}