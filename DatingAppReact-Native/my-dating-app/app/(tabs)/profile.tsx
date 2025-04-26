import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👤 Hồ sơ của bạn</Text>
      <Button title="Đăng xuất" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});
