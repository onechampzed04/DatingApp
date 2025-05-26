import { Redirect } from 'expo-router';

export default function TabsIndexRedirect() {
  // Điều hướng ngay lập tức đến trang explore
  return <Redirect href="/(tabs)/profile" />;
}