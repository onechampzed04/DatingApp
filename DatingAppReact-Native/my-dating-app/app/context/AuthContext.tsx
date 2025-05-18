import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authApi from '../../utils/api';
import { getUserByEmail } from '../../utils/api';
import { useRouter } from 'expo-router';

interface User {
  userId: number; // Added userId
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginUser: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setAuthenticatedSession: (userData: User, token: string) => Promise<void>; // New function
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loginUser: async () => {},
  register: async () => {},
  logout: async () => {},
  setAuthenticatedSession: async () => {}, // New function default
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
          setUser(parsedUser); // Assumes storedUser contains userId
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAuth();
  }, []);

  const loginUser = async (data: { email: string; password: string }) => {
    try {
      const response = await authApi.login(data); // This is the token response
      
      // 👉 Gọi API để lấy thông tin user theo email to get full user details including UserID
      const fullUserResponse = await getUserByEmail(data.email); // Assuming login email is the key
      
      if (!fullUserResponse || !fullUserResponse.userID) {
        throw new Error("User details not found or UserID is missing.");
      }

      const userData: User = {
        userId: fullUserResponse.userID, // Store UserID
        username: fullUserResponse.username, // Assuming username is in fullUserResponse
        email: fullUserResponse.email    // Assuming email is in fullUserResponse
      };
  
      setUser(userData);
      setToken(response.data.token); // Assuming token is in the login response
  
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('token', response.data.token ?? '');
  
      if (fullUserResponse.isEmailVerified === false) {
        // ❌ Chưa xác thực → chuyển sang OTP
        router.replace({ pathname: '/(auth)/otp', params: { email: userData.email } });
      } else {
        // ✅ Đã xác thực → vào app
        router.replace('/(tabs)/explore');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (data: { username: string; email: string; password: string }) => {
    try {
      // Step 1: Register the user (backend should create the user and return basic info or just success)
      // The current `authApi.register` returns AuthResponse which doesn't have userID.
      await authApi.register(data); 

      // Step 2: After successful registration, fetch the full user details including UserID
      const fullUserResponse = await getUserByEmail(data.email);

      if (!fullUserResponse || !fullUserResponse.userID) {
        // This case should ideally not happen if registration was successful and user exists
        throw new Error("User details not found after registration or UserID is missing.");
      }

      const userData: User = {
        userId: fullUserResponse.userID,
        username: fullUserResponse.username,
        email: fullUserResponse.email
      };
      
      setUser(userData);
      // Typically, registration doesn't log the user in directly or issue a token.
      // The user would then proceed to login.
      // However, if your auth/register endpoint *does* return a token and logs in, adjust accordingly.
      // For now, just storing user details. Token will be set upon login.
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      // After registration, you likely want to navigate them to OTP verification or login.
      // Assuming new users need to verify email via OTP:
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
      // Optionally, clear session if saving fails to prevent inconsistent state
      setUser(null);
      setToken(null);
      await AsyncStorage.multiRemove(['user', 'token']);
      throw error; // Re-throw to allow caller to handle
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loginUser, register, logout, setAuthenticatedSession, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
