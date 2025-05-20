import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { View, ActivityIndicator, Text } from 'react-native'; // Added for loading indicator

function ProtectedLayout() {
  const { token, isLoading } = useAuth(); // Use token and isLoading
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) {
      return; // Don't do anything until authentication state is loaded
    }

    const inAuthGroup = segments[0] === '(auth)';

    // If authentication is loaded (not isLoading):
    // 1. If there's no token AND the user is NOT in an auth group screen (trying to access protected content)
    //    => redirect to login.
    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
    
    // 2. If there IS a token AND the user IS in an auth group screen
    //    This case is now primarily handled by (auth)/_layout.tsx.
    //    (auth)/_layout.tsx will redirect from 'login', 'otp' etc., to '/(tabs)/explore' if a token exists.
    //    It will allow 'habit', 'profile_setup' to render even with a token.
    //    So, this specific check here might be redundant or could conflict if not careful.
    //    Let's ensure this doesn't prematurely redirect from 'habit' if (auth)/_layout allows it.
    //    The (auth)/_layout.tsx is more specific for routes within (auth).
    //    This root layout should primarily protect non-auth routes.
    //
    //    Consider the case where (auth)/_layout.tsx decides to render a screen like 'habit' (because token exists).
    //    We don't want this root layout to then immediately redirect 'habit' to 'explore'.
    //    The logic in (auth)/_layout.tsx is: if token and on 'login' -> redirect to 'explore'.
    //                                       if token and on 'habit' -> render 'habit'.
    //    This root layout's job: if no token and NOT in (auth) -> redirect to 'login'.
    //
    //    The original `if (token && inAuthGroup)` might be too broad now.
    //    Let's remove it or make it more specific if needed, but (auth)/_layout.tsx should handle its children.
    //
    // if (token && inAuthGroup) {
    //   // This might redirect from 'habit' to 'explore' if not careful.
    //   // (auth)/_layout.tsx is better suited to decide this.
    //   // For example, if currentAuthScreen in (auth)/_layout is 'login', it redirects.
    //   // If it's 'habit', it renders Slot.
    //   // router.replace('/(tabs)/explore'); // Potentially problematic
    // }

  }, [token, segments, router, isLoading]); // Depend on token, segments, router, and isLoading

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#EB3C58" />
        <Text>Initializing App...</Text>
      </View>
    );
  }

  return <Slot />; // Render the children routes (either (auth) group or (tabs) group etc.)
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProtectedLayout />
    </AuthProvider>
  );
}
