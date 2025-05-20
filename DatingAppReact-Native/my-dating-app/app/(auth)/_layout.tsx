import { Slot, Redirect, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native'; // Added Text, ActivityIndicator

export default function AuthLayout() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  // segments for (auth) group will be like ['(auth)', 'login'] or ['(auth)', 'habit']
  // We need the screen name, which is segments[1] if segments[0] is '(auth)'
  const currentAuthScreen = segments.length > 1 && segments[0] === '(auth)' ? segments[1] : null;

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#EB3C58" />
        <Text>Loading Authentication...</Text>
      </View>
    );
  }

  if (token) {
    // User has a token.
    // Define screens that are purely for initial authentication (login, OTP).
    // If the user is on one of these and has a token, they should be in the main app.
    const initialAuthScreens = ['login', 'login_email', 'login_phone', 'otp'];
    if (currentAuthScreen && initialAuthScreens.includes(currentAuthScreen)) {
      return <Redirect href="/(tabs)/explore" />;
    }
    // If the user has a token and is on other screens within the (auth) group 
    // like 'habit' or 'profile_setup', these are considered valid post-auth setup steps,
    // so we allow them to render by falling through to the Slot.
  }
  
  // If no token, render the current auth screen (e.g., login, otp).
  // Or, if a token exists and the screen is a valid post-auth setup screen (e.g., habit, profile_setup), render it.
  return (
    <View style={{ flex: 1 }}>
      <Slot />
    </View>
  );
}
