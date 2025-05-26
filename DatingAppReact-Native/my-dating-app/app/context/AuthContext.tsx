// AuthContext.tsx
// ... (các phần import và khai báo interface giữ nguyên)
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authApi from '../../utils/api'; // Giữ lại để dùng cho login, register
import { getUserByEmail, sendOtp } from '../../utils/api'; // Import trực tiếp sendOtp
import { useRouter } from 'expo-router';

interface User {
  userId: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginUser: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setAuthenticatedSession: (userData: User, token: string) => Promise<void>;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loginUser: async () => {},
  register: async () => {},
  logout: async () => {},
  setAuthenticatedSession: async () => {},
  isLoading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAuth();
  }, []);

  // ĐÂY LÀ HÀM loginUser ĐÃ CẬP NHẬT
  const loginUser = async (data: { email: string; password: string }) => {
    try {
      const response = await authApi.login(data);
      const fullUserResponse = await getUserByEmail(data.email);

      if (!fullUserResponse || !fullUserResponse.userID) {
        throw new Error("User details not found or UserID is missing.");
      }

      const userData: User = {
        userId: fullUserResponse.userID,
        username: fullUserResponse.username,
        email: fullUserResponse.email
      };

      setUser(userData);
      setToken(response.data.token);

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('token', response.data.token ?? '');

      if (fullUserResponse.isEmailVerified === false) {
        try {
          console.log(`[AuthContext] User ${userData.email} is not verified. Sending OTP.`);
          await sendOtp(userData.email); // Gửi OTP
          console.log(`[AuthContext] OTP sent to ${userData.email}. Navigating to OTP screen.`);
        } catch (otpError) {
          console.error('[AuthContext] Failed to send OTP during login for unverified user:', otpError);
        }
        router.replace({ pathname: '/(auth)/otp', params: { email: userData.email } });
      } else {
        router.replace('/(tabs)/explore');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // ĐÂY LÀ HÀM register ĐÃ CẬP NHẬT
  const register = async (data: { username: string; email: string; password: string }) => {
    try {
      await authApi.register(data);
      const fullUserResponse = await getUserByEmail(data.email);

      if (!fullUserResponse || !fullUserResponse.userID) {
        throw new Error("User details not found after registration or UserID is missing.");
      }

      const userData: User = {
        userId: fullUserResponse.userID,
        username: fullUserResponse.username,
        email: fullUserResponse.email
      };
      
      setUser(userData); // Có thể set user ở đây hoặc không, tùy thuộc vào luồng bạn muốn
      await AsyncStorage.setItem('user', JSON.stringify(userData)); // Lưu user vào storage

      // Sau khi đăng ký, gửi OTP và điều hướng đến màn hình OTP
      try {
        console.log(`[AuthContext] New user ${userData.email} registered. Sending OTP.`);
        await sendOtp(userData.email); // Gửi OTP sau khi đăng ký thành công
        console.log(`[AuthContext] OTP sent to ${userData.email} post-registration. Navigating to OTP screen.`);
      } catch (otpError) {
        console.error('[AuthContext] Failed to send OTP after registration:', otpError);
      }
      router.replace({ pathname: '/(auth)/otp', params: { email: userData.email } });

    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setToken(null);
      await AsyncStorage.multiRemove(['user', 'token']);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const setAuthenticatedSession = async (userData: User, authToken: string) => {
    try {
      setUser(userData);
      setToken(authToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('token', authToken);
    } catch (error) {
      console.error('Error setting authenticated session:', error);
      setUser(null);
      setToken(null);
      await AsyncStorage.multiRemove(['user', 'token']);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loginUser, register, logout, setAuthenticatedSession, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);