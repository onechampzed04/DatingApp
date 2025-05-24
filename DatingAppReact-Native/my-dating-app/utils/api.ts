import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Common base URL
const API_BASE_URL = 'http://10.0.2.2:5281/api';

// --- Axios Instances ---
const authApi = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  headers: { 'Content-Type': 'application/json' },
});
authApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const userApi = axios.create({
  baseURL: `${API_BASE_URL}/Users`,
});
userApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const swipeApi = axios.create({
  baseURL: `${API_BASE_URL}/Swipes`,
});
swipeApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  console.log('[DEBUG] swipeApi Interceptor - Token:', token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('[DEBUG] swipeApi Interceptor - Header Set:', config.headers.Authorization);
  } else {
    console.warn('[DEBUG] swipeApi Interceptor - No token found.');
  }
  return config;
});

const interestApi = axios.create({
  baseURL: `${API_BASE_URL}/Interests`,
});
interestApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const userInterestApi = axios.create({
  baseURL: `${API_BASE_URL}/UserInterests`,
});
userInterestApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- AUTH TYPES & FUNCTIONS ---
interface AuthResponse {
  message: string;
  data: {
    username: string;
    email: string;
    token: string | null;
    userId?: number;
  };
}

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
}

interface EmailCheckResponse {
  message: string;
  data: {
    exists: boolean;
  };
}

export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await authApi.post('/register', data);
  return response.data;
};

export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await authApi.post<AuthResponse>('/login', data);
  if (response.data.data.token) {
    await AsyncStorage.setItem('token', response.data.data.token);
  }
  if (response.data.data.userId) {
    await AsyncStorage.setItem('userId', response.data.data.userId.toString());
  }
  return response.data;
};

export const sendOtp = async (email: string) => {
  const response = await authApi.post('/send-otp', email);
  return response.data;
};

export const verifyOtp = async (email: string, otpCode: string): Promise<{
  message: string;
  data?: {
    user: {
      userId: number;
      username: string;
      email: string;
    };
    token: string;
  };
}> => {
  const response = await authApi.post('/verify-otp', { email, otpCode });
  if (response.data.data && response.data.data.token && response.data.data.user && response.data.data.user.userId) {
    await AsyncStorage.setItem('token', response.data.data.token);
    await AsyncStorage.setItem('userId', response.data.data.user.userId.toString());
  }
  return response.data;
};

export const checkEmail = async (email: string): Promise<EmailCheckResponse> => {
  const response = await authApi.post('/check-email', email);
  return response.data;
};

// --- USER TYPES ---
export interface ApiUser {
  userID: number;
  username: string;
  passwordHash?: string;
  fullName?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  bio?: string | null;
  avatar?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  phoneNumber?: string | null;
  email: string;
  facebookID?: string | null;
  googleID?: string | null;
  lastLoginDate?: string | null;
  isEmailVerified: boolean;
  profileVisibility?: number | null;
  accountStatus?: number | null;
  address?: string | null;
}

export interface ApiUserCard {
  userID: number;
  fullName: string | null;
  avatar: string | null;
  age: number | null;
}

export interface MatchedUserDetails {
  userId: number;
  fullName: string | null;
  avatar: string | null;
  age: number | null;
}

export type UserProfileUpdateData = Partial<Omit<ApiUser,
  'userID' |
  'username' |
  'passwordHash' |
  'createdAt' |
  'email' |
  'isEmailVerified' |
  'lastLoginDate'
>>;

// --- USER FUNCTIONS ---
export const getUserByEmail = async (email: string): Promise<ApiUser | null> => {
  try {
    const response = await userApi.get<ApiUser>('/by-email', { params: { email } });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error('Lỗi khi lấy người dùng bằng email:', error);
    throw error;
  }
};

export const getUserById = async (userId: number): Promise<ApiUser | null> => {
  try {
    const response = await userApi.get<ApiUser>(`/${userId}`);
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      console.warn(`Không tìm thấy người dùng với ID ${userId}.`);
      return null;
    }
    console.error(`Lỗi khi lấy người dùng bằng ID ${userId}:`, error);
    throw error;
  }
};

export const getUsersForSwiping = async (params: { pageNumber: number; pageSize: number }): Promise<ApiUserCard[]> => {
  try {
    const response = await userApi.get<ApiUserCard[]>('/', { params });
    console.log(`[API] getUsersForSwiping (page ${params.pageNumber}) response:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error(`[API] Error fetching users for swiping (page ${params.pageNumber}):`, error.response?.data || error.message);
    if (error.isAxiosError) console.error("[API DEBUG] Axios error config for getUsersForSwiping:", error.config);
    throw error;
  }
};

export const updateUserProfile = async (userId: number, updates: UserProfileUpdateData): Promise<ApiUser | null> => {
  try {
    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Error(`User with ID ${userId} not found.`);
    }
    const updatedUserData: ApiUser = {
      ...currentUser,
      ...updates,
      userID: currentUser.userID,
    };
    const response = await userApi.put<ApiUser>(`/${userId}`, updatedUserData);
    if (response.status === 204) {
      return { ...updatedUserData };
    }
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

// --- SWIPE TYPES ---
export interface SwipeCreateDTO {
  toUserID: number;
  isLike: boolean;
}

export interface SwipeMatchResponse {
  message: string;
  isMatch: boolean;
  matchedWithUser?: MatchedUserDetails;
}

// --- SWIPE FUNCTIONS ---
export const createSwipe = async (data: SwipeCreateDTO): Promise<SwipeMatchResponse> => {
  try {
    console.log('[API] Calling createSwipe with data:', data);
    const response = await swipeApi.post<SwipeMatchResponse>('/createswipe', data);
    console.log('[API] createSwipe response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('[API] Error creating swipe:', error.response?.status, error.response?.data || error.message);
    if (error.isAxiosError) {
      console.error("[API DEBUG] Axios error config for createSwipe:", error.config);
      if (error.response) console.error("[API DEBUG] Axios error response for createSwipe:", error.response);
    }
    throw error;
  }
};

// --- INTEREST TYPES & FUNCTIONS ---
export interface Interest {
  interestId: number;
  interestName: string;
}

export interface UserInterestData {
  userId: number;
  interestIds: number[];
}

export const getAllInterests = async (): Promise<Interest[]> => {
  try {
    const response = await interestApi.get<Interest[]>('/');
    return response.data;
  } catch (error) {
    console.error('Lỗi khi lấy tất cả sở thích:', error);
    throw error;
  }
};

export const getUserInterests = async (userId: number): Promise<Interest[]> => {
  try {
    const response = await userApi.get<Interest[]>(`/${userId}/interests`);
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching interests for user ID ${userId}:`, error.response?.data || error.message);
    throw error;
  }
};

export const saveUserInterests = async (data: UserInterestData): Promise<any> => {
  try {
    const response = await userInterestApi.post('/SaveUserInterests', data);
    return response.data;
  } catch (error) {
    console.error('Lỗi khi lưu sở thích người dùng:', error);
    throw error;
  }
};

// Export default
export default authApi;