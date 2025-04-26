import { Redirect, useRouter, usePathname, Slot } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Icon bộ Ionicons
import { useState } from 'react';

export default function TabsLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // 👈 Lấy đường dẫn hiện tại

  const [activeIcon, setActiveIcon] = useState<string | null>(null);

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const isActive = (path: string) => pathname === path; // 👈 Kiểm tra chính xác trang active

  return (
    <View style={styles.container}>
      {/* Nội dung trang con */}
      <View style={styles.content}>
        <Slot />
      </View>

      {/* Footer navigation */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => {
            router.replace('/(tabs)/explore');
            setActiveIcon('/(tabs)/explore');
          }}
          onPressIn={() => setActiveIcon('/(tabs)/explore')}
          onPressOut={() => setActiveIcon(null)}
        >
          <Ionicons
            name="search-outline"
            size={28}
            color={isActive('/(tabs)/explore') || activeIcon === '/(tabs)/explore' ? '#EA405A' : 'black'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            router.replace('/(tabs)/discover');
            setActiveIcon('/(tabs)/discover');
          }}
          onPressIn={() => setActiveIcon('/(tabs)/discover')}
          onPressOut={() => setActiveIcon(null)}
        >
          <Ionicons
            name="compass-outline"
            size={28}
            color={isActive('/(tabs)/discover') || activeIcon === '/(tabs)/discover' ? '#EA405A' : 'black'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            router.replace('/(tabs)/matches');
            setActiveIcon('/(tabs)/matches');
          }}
          onPressIn={() => setActiveIcon('/(tabs)/matches')}
          onPressOut={() => setActiveIcon(null)}
        >
          <Ionicons
            name="heart-outline"
            size={28}
            color={isActive('/(tabs)/matches') || activeIcon === '/(tabs)/matches' ? '#EA405A' : 'black'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            router.replace('/(tabs)/profile');
            setActiveIcon('/(tabs)/profile');
          }}
          onPressIn={() => setActiveIcon('/(tabs)/profile')}
          onPressOut={() => setActiveIcon(null)}
        >
          <Ionicons
            name="person-outline"
            size={28}
            color={isActive('/(tabs)/profile') || activeIcon === '/(tabs)/profile' ? '#EA405A' : 'black'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f8f8f8',
  },
});
