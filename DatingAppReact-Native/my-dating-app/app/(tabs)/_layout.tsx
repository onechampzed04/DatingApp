import { Redirect, Slot, usePathname } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUserByEmail } from '../../utils/api'; // 🟡 Thêm hàm này trong api.ts nếu chưa có
import { useRouter } from 'expo-router';

export default function TabsLayout() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const router = useRouter();
  const tabs = ['explore', 'discover', 'matches', 'profile'] as const;

  useEffect(() => {
    const checkVerify = async () => {
      if (user) {
        try {
          const fullUser = await getUserByEmail(user.email);
          setIsVerified(fullUser?.isEmailVerified ?? false);
        } catch (err) {
          console.error('Lỗi kiểm tra email xác thực:', err);
        }
      }
    };

    checkVerify();
  }, [user]);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isVerified === false && pathname !== '/(auth)/otp') {
    return <Redirect href={{ pathname: '/(auth)/otp', params: { email: user.email } }} />;
  }

  if (isVerified === null) {
    return null; // đang kiểm tra...
  }

  // ✅ Layout hiển thị khi đã login và xác thực
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View style={styles.footer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => router.replace(`/(tabs)/${tab}` as const)} // ✅ ép kiểu an toàn
        >
          <Ionicons
            name={
              tab === 'explore'
                ? 'search-outline'
                : tab === 'discover'
                ? 'compass-outline'
                : tab === 'matches'
                ? 'heart-outline'
                : 'person-outline'
            }
            size={28}
            color={pathname.includes(tab) ? '#EA405A' : 'black'}
          />
        </TouchableOpacity>
      ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingTop: 50, paddingHorizontal: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f8f8f8',
  },
});
