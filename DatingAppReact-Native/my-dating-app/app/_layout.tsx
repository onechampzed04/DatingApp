import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedLayout() {
  const { token } = useAuth(); // Use token instead of user
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    // If there's no token and the user is trying to access a protected route (not in auth group),
    // redirect to login.
    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
    
    // If there IS a token and the user is currently in an auth group page 
    // (e.g. login, register), they should be redirected to the main app.
    // The (auth)/_layout.tsx already handles this, but this is a safeguard.
    if (token && inAuthGroup) {
      router.replace('/(tabs)/explore');
    }
  }, [token, segments, router]); // Depend on token

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProtectedLayout />
    </AuthProvider>
  );
}
