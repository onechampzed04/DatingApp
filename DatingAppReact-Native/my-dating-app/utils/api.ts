// api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- PHẦN ĐỊNH NGHĨA TỪ MÃ GỐC CỦA BẠN ---
const API_URL = 'http://10.0.2.2:5281/api/auth';

const auth_api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

auth_api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const userApi = axios.create({
  baseURL: 'http://10.0.2.2:5281/api/Users', // URL gốc của bạn cho userApi
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
    userId?: number; // Thêm: Giả sử login response CÓ THỂ chứa userId
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
  const response = await auth_api.post<AuthResponse>('/login', data); // Gõ response
  if (response.data.data.token) {
    await AsyncStorage.setItem('token', response.data.data.token);
  }
  // Lưu userId nếu backend /login endpoint trả về nó
  if (response.data.data.userId) {
    await AsyncStorage.setItem('userId', response.data.data.userId.toString());
  }
  return response.data;
};

// Giữ nguyên cách triển khai gốc: gửi chuỗi email trực tiếp làm body
export const sendOtp = async (email: string) => {
  const response = await auth_api.post('/send-otp', email);
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
  const response = await auth_api.post('/verify-otp', { email, otpCode });
  // Lưu token và userId nếu xác minh thành công và có dữ liệu
  if (response.data.data && response.data.data.token && response.data.data.user && response.data.data.user.userId) {
    await AsyncStorage.setItem('token', response.data.data.token);
    await AsyncStorage.setItem('userId', response.data.data.user.userId.toString());
  }
  return response.data;
};

// Giữ nguyên cách triển khai gốc: gửi chuỗi email trực tiếp làm body
export const checkEmail = async (email: string): Promise<EmailCheckResponse> => {
  const response = await auth_api.post('/check-email', email);
  return response.data;
};
// --- KẾT THÚC PHẦN ĐỊNH NGHĨA TỪ MÃ GỐC CỦA BẠN ---


// --- BẮT ĐẦU: User Model VÀ CÁC HÀM API LIÊN QUAN (TỪ MÃ GỐC CỦA BẠN + BỔ SUNG MỚI) ---

// Định nghĩa kiểu cho đối tượng User được trả về từ backend
// (Đã có trong mã gốc của bạn)
export interface ApiUser { // Thêm export, vì nó được sử dụng trong signature của hàm
  userID: number;
  username: string;
  passwordHash?: string;
  fullName?: string | null;
  gender?: string | null;
  birthdate?: string | null; // Mong đợi định dạng chuỗi ISO ví dụ: "YYYY-MM-DD" hoặc "YYYY-MM-DDTHH:mm:ssZ"
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

export const getUserInterests = async (userId: number): Promise<Interest[]> => {
  try {
    // Gọi đến userApi, không phải userInterestApi hay interestApi
    const response = await userApi.get<Interest[]>(`/${userId}/interests`);
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching interests for user ID ${userId}:`, error.response?.data || error.message);
    throw error;
  }
};
// Kiểu dữ liệu để cập nhật hồ sơ người dùng. Các trường là tùy chọn.
// Bỏ qua các trường không nên cập nhật trực tiếp theo cách này (ví dụ: ID, email, ngày tạo)
export type UserProfileUpdateData = Partial<Omit<ApiUser,
  'userID' |
  'username' |
  'passwordHash' |
  'createdAt' |
  'email' |
  'isEmailVerified' |
  'lastLoginDate' // Thường do backend quản lý
>>;

// getUserByEmail (từ mã gốc của bạn)
export const getUserByEmail = async (email: string): Promise<ApiUser | null> => {
  try {
    const response = await userApi.get<ApiUser>('/by-email', { params: { email } });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return null; // Không tìm thấy người dùng
    }
    console.error('Lỗi khi lấy người dùng bằng email:', error);
    throw error;
  }
};

// MỚI: Lấy User bằng ID
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

// MỚI: Cập nhật Hồ sơ Người dùng
export const updateUserProfile = async (userId: number, updates: UserProfileUpdateData): Promise<ApiUser | null> => {
  try {
    const currentUser = await getUserById(userId); // Lấy thông tin user hiện tại
    if (!currentUser) {
      // ... (xử lý lỗi user không tìm thấy)
      throw new Error(`User with ID ${userId} not found.`);
    }

    // Merge updates vào currentUser. Backend của bạn (Cách 2) sẽ chỉ
    // cập nhật các trường được gán giá trị mới.
    const updatedUserData: ApiUser = {
      ...currentUser,
      ...updates, // updates ở đây sẽ là { avatar: "data:image/jpeg;base64,..." }
      userID: currentUser.userID,
    };
    
    const response = await userApi.put<ApiUser>(`/${userId}`, updatedUserData); 
    
    if (response.status === 204) { 
        return { ...updatedUserData }; // Trả về dữ liệu đã được cập nhật (phía client)
    }
    return response.data; 
  } catch (error: any) {
    // ... (xử lý lỗi)
    throw error;
  }
};
// --- KẾT THÚC: User Model VÀ CÁC HÀM API LIÊN QUAN ---


// --- BẮT ĐẦU: MÃ LIÊN QUAN ĐẾN INTEREST (TỪ MÃ GỐC CỦA BẠN) ---
export interface Interest { // Thêm export
  interestId: number;
  interestName: string;
}

export interface UserInterestData { // Thêm export
  userId: number;
  interestIds: number[];
}

const interestApi = axios.create({
  baseURL: 'http://10.0.2.2:5281/api/Interests', // Gốc của bạn
});

interestApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const userInterestApi = axios.create({
  baseURL: 'http://10.0.2.2:5281/api/UserInterests', // Gốc của bạn
});

userInterestApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getAllInterests = async (): Promise<Interest[]> => {
  try {
    const response = await interestApi.get<Interest[]>('/');
    return response.data;
  } catch (error) {
    console.error('Lỗi khi lấy tất cả sở thích:', error);
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
// --- KẾT THÚC: MÃ LIÊN QUAN ĐẾN INTEREST ---

export default auth_api; // Default export gốc của bạn
// Lưu ý: Các hàm mới (getUserById, updateUserProfile) là named exports.