import { useEffect } from 'react'; // 👈 thêm dòng này
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)"; 
    // Nếu URL đang ở nhóm (auth), ví dụ như /login /register

    if (!user && !inAuthGroup) {
      router.replace("/login"); // Nếu chưa login và không ở login page => đá về login
    }
    if (user && inAuthGroup) {
      router.replace("/(tabs)/explore"); // Nếu đã login mà còn ở login page => đá về home (index)
    }
  }, [user, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProtectedLayout />
    </AuthProvider>
  );
}
