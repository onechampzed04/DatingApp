// app/(auth)/_layout.tsx
import { Slot, Redirect, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native';

export default function AuthLayout() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
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
    // Chỉ redirect từ các màn hình login/đăng ký ban đầu nếu đã có token.
    // Màn hình OTP sẽ tự điều hướng sau khi xác thực thành công.
    const screensToRedirectFromIfTokenExists = ['login', 'login_email', 'login_phone', 'register']; // Bỏ 'otp'

    if (currentAuthScreen && screensToRedirectFromIfTokenExists.includes(currentAuthScreen)) {
      console.log(`[AuthLayout] Token exists and on '${currentAuthScreen}', redirecting to /tabs/explore`);
      return <Redirect href="/(tabs)/explore" />;
    }
    // Nếu là 'otp' và có token, <Slot /> sẽ render otp.tsx,
    // và otp.tsx sẽ gọi router.replace('/(setup)/gender') sau khi alert.
    // Nếu là các màn hình setup khác trong (auth) group (ví dụ profile_setup.tsx), chúng sẽ được render.
  }
  
  return (
    <View style={{ flex: 1 }}>
      <Slot />
    </View>
  );
}