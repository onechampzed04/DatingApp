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

  console.log('TabsLayout - user:', user, 'isVerified:', isVerified); // Thêm log để debug

  if (!user) {
    console.log('No user, redirecting to login');
    return <Redirect href="/(auth)/login" />;
  }

  if (isVerified === false && pathname !== '/(auth)/otp') {
    console.log('User not verified, redirecting to OTP');
    return <Redirect href={{ pathname: '/(auth)/otp', params: { email: user.email } }} />;
  }

  if (isVerified === null) {
    return null; // đang kiểm tra...
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View style={styles.footer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => router.replace(`/(tabs)/${tab}` as const)}
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
  container: { flex: 1,  },
  content: { flex: 1},
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#EA405A',
    backgroundColor: '#f8f8f8',
    zIndex: 100,
  },
});
