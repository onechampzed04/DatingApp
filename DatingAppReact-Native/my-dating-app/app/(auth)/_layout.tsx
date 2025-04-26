import { Slot, Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, Text } from 'react-native';

export default function AuthLayout() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Slot />
    </View>
  );
}
