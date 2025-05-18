import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.0.2.2:5281/api/auth';

const auth_api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
// auth auth_api
auth_api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const userApi = axios.create({
  baseURL: 'http://10.0.2.2:5281/api/Users',
});

userApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface AuthResponse {
  message: string;
  data: {
    username: string;
    email: string;
    token: string | null;
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
  const response = await auth_api.post('/register', data);
  return response.data;
};

export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await auth_api.post('/login', data);
  if (response.data.data.token) {
    await AsyncStorage.setItem('token', response.data.data.token);
  }
  return response.data;
};

export const sendOtp = async (email: string) => {
  const response = await auth_api.post('/send-otp', email);
  return response.data;
};

// Reverted: verifyOtp likely just returns a simple success/error message structure,
// not a full token and user object. The error screenshot suggests this.
export const verifyOtp = async (email: string, otpCode: string): Promise<{ message: string, data?: any }> => { // Looser typing for now
  const response = await auth_api.post('/verify-otp', { email, otpCode });
  return response.data;
};

export const checkEmail = async (email: string): Promise<EmailCheckResponse> => {
  const response = await auth_api.post('/check-email', email);
  return response.data;
};

// uuser auth_api

// Define a type for the User object returned by the backend
interface ApiUser {
  userID: number;
  username: string;
  passwordHash: string;
  fullName?: string;
  gender?: string;
  birthdate?: string; // Consider using Date type if conversion is handled
  bio?: string;
  avatar?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string; // Consider using Date type
  phoneNumber?: string;
  email: string;
  facebookID?: string;
  googleID?: string;
  lastLoginDate?: string; // Consider using Date type
  isEmailVerified: boolean;
  profileVisibility?: number;
  accountStatus?: number;
  address?: string;
  // Add other fields from your backend User model if needed
}

// Interface for Interest (matches InterestDTO from backend)
export interface Interest {
  interestId: number;
  interestName: string;
}

// Interface for UserInterestDTO to send to backend
export interface UserInterestData {
  userId: number;
  interestIds: number[];
}

const interestApi = axios.create({
  baseURL: 'http://10.0.2.2:5281/api/Interests',
});

interestApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const userInterestApi = axios.create({
  baseURL: 'http://10.0.2.2:5281/api/UserInterests',
});

userInterestApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


export const getUserByEmail = async (email: string): Promise<ApiUser | null> => {
  try {
    const response = await userApi.get<ApiUser>('/by-email', { params: { email } });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return null; // User not found
    }
    console.error('Error fetching user by email:', error);
    throw error; // Re-throw other errors
  }
};

// API function to get all interests
export const getAllInterests = async (): Promise<Interest[]> => {
  try {
    const response = await interestApi.get<Interest[]>('/');
    return response.data;
  } catch (error) {
    console.error('Error fetching all interests:', error);
    throw error;
  }
};

// API function to save user interests
export const saveUserInterests = async (data: UserInterestData): Promise<any> => { // Backend returns Ok("User interests updated successfully.")
  try {
    // The backend endpoint is /api/UserInterests/SaveUserInterests
    // The DTO matches UserInterestDTO: { UserId, InterestIds }
    const response = await userInterestApi.post('/SaveUserInterests', data);
    return response.data; 
  } catch (error) {
    console.error('Error saving user interests:', error);
    throw error;
  }
};

export default auth_api;
