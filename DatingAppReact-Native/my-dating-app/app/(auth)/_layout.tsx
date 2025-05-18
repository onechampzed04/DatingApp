import { Slot, Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View } from 'react-native';

export default function AuthLayout() {
  const { token } = useAuth(); // Use token to check for full authentication

  if (token) {
    // If a token exists, the user is fully authenticated.
    // Redirect them away from auth screens (login, register, OTP) to the main app.
    return <Redirect href="/(tabs)/explore" />;
  }
  
  // If no token, render the current auth screen (e.g., login, register, or OTP page).
  return (
    <View style={{ flex: 1 }}>
      <Slot />
    </View>
  );
}
