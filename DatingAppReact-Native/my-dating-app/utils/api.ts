import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from 'axios'; // Add InternalAxiosRequestConfig
import AsyncStorage from '@react-native-async-storage/async-storage';

// Common base URL
export const API_BASE_URL = 'http://10.0.2.2:5281'; // Base URL without /api

// --- Axios Instances ---
const authApi = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  headers: { 'Content-Type': 'application/json' },
});
authApi.interceptors.request.use(async (config: InternalAxiosRequestConfig) => { // Use InternalAxiosRequestConfig
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {}; // Ensure headers is defined
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const userApi = axios.create({
  baseURL: `${API_BASE_URL}/api/Users`,
});
userApi.interceptors.request.use(async (config: InternalAxiosRequestConfig) => { // Use InternalAxiosRequestConfig
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {}; // Ensure headers is defined
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log(
    '[DEBUG userApi Request]',
    'Method:', config.method?.toUpperCase(),
    'URL:', (config.baseURL || '') + (config.url || ''),
    'Is FormData:', config.data instanceof FormData,
    'Headers:', config.headers ? JSON.stringify(config.headers) : 'No Headers'
  );
  return config;
});
userApi.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    if (axios.isAxiosError(error)) {
      console.error(
        '[DEBUG userApi Response Error]',
        'Status:', error.response?.status,
        'Data:', error.response?.data,
        'Config URL:', error.config ? (error.config.baseURL || '') + (error.config.url || '') : 'N/A Config URL',
        'Config Headers:', error.config?.headers ? JSON.stringify(error.config.headers) : 'N/A Config Headers'
      );
    } else {
      console.error('[DEBUG userApi Response Error] Non-Axios error:', error);
    }
    return Promise.reject(error);
  }
);


export const updateUserProfileWithFetch = async (
  userId: number,
  updates: UserProfileModificationData,
  avatarFile?: ExpoImageFile | null
): Promise<void> => {
  const url = `${API_BASE_URL}/api/Users/${userId}`;
  const token = await AsyncStorage.getItem('token');

  const formData = new FormData();

  // Append text data
  (Object.keys(updates) as Array<keyof UserProfileModificationData>).forEach(key => {
    const value = updates[key];
    if (value !== undefined && value !== null) {
      if (key === 'birthdate' && value) {
        formData.append(key, new Date(value as string).toISOString());
      } else {
        formData.append(key, String(value)); // FormData tự động chuyển đổi
      }
    }
  });

  // Append file data
  if (avatarFile) {
    // Đối với React Native, cấu trúc của file object cho FormData hơi khác
    const fileToUpload = {
      uri: avatarFile.uri,
      name: avatarFile.name,
      type: avatarFile.type, // Ví dụ: 'image/jpeg'
    };
    formData.append('avatarFile', fileToUpload as any); // 'avatarFile' phải khớp với tên param ở backend
  }

  console.log(`[DEBUG updateUserProfileWithFetch] Sending PUT to ${url}`);
  console.log(`[DEBUG updateUserProfileWithFetch] FormData entries:`);
  // @ts-ignore FormData.entries() có thể không được TS nhận diện tốt trong mọi môi trường
  for (let pair of formData.entries()) {
    const value = pair[1];
    const isFileLike = value && typeof value === 'object' && 'uri' in value;
    console.log(`[DEBUG updateUserProfileWithFetch] ${pair[0]}: ${isFileLike ? `File name: ${(value as any).name}, type: ${(value as any).type}, uri: ${(value as any).uri}` : value}`);
  }


  const headers: HeadersInit = {
    // KHÔNG set 'Content-Type' ở đây, fetch sẽ tự làm cho FormData
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: headers,
      body: formData,
    });

    console.log(`[DEBUG updateUserProfileWithFetch] Response Status: ${response.status}`);
    const responseText = await response.text(); // Đọc text để debug, kể cả khi là 204
    console.log(`[DEBUG updateUserProfileWithFetch] Response Text: ${responseText}`);


    if (!response.ok) {
      // response.ok là true nếu status là 200-299
      let errorData: any = null;
      try {
        if (responseText) {
          errorData = JSON.parse(responseText); // Thử parse nếu là JSON
        }
      } catch (e) {
        // Không phải JSON hoặc rỗng
      }
      console.error('[DEBUG updateUserProfileWithFetch] Error Data from response:', errorData || responseText);
      // Tạo một lỗi giống Axios để các component khác có thể bắt
      const error: any = new Error(`Request failed with status ${response.status}: ${responseText}`);
      error.response = {
        status: response.status,
        data: errorData || { message: responseText }, // Giả lập cấu trúc data của Axios error
      };
      throw error;
    }

    // Backend trả về 204 NoContent, không có body
    if (response.status === 204) {
      return; // Thành công
    }

    // Nếu backend trả về cái gì đó khác (ví dụ 200 OK với data)
    // thì xử lý ở đây, hiện tại ta mong đợi 204
    return;

  } catch (error: any) {
    console.error('[DEBUG updateUserProfileWithFetch] Network or other error:', error.message);
    // Đảm bảo ném lại lỗi để component gọi có thể xử lý
    if (error.response) { // Nếu là lỗi đã được tạo ở trên
        throw error;
    }
    // Nếu là lỗi mạng thực sự (fetch ném ra)
    const networkError: any = new Error(error.message || 'Network request failed');
    networkError.isNetworkError = true; // Gắn cờ để dễ nhận biết
    throw networkError;
  }
};



const swipeApi = axios.create({
  baseURL: `${API_BASE_URL}/api/Swipes`,
});
swipeApi.interceptors.request.use(async (config: InternalAxiosRequestConfig) => { // Use InternalAxiosRequestConfig
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {}; // Ensure headers is defined
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const interestApi = axios.create({
  baseURL: `${API_BASE_URL}/api/Interests`,
});
interestApi.interceptors.request.use(async (config: InternalAxiosRequestConfig) => { // Use InternalAxiosRequestConfig
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {}; // Ensure headers is defined
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- AUTH TYPES & FUNCTIONS ---
// (Giữ nguyên các interface này)
interface AuthResponse {
  message: string;
  data: {
    username: string;
    email: string;
    token: string | null;
    userId?: number;
  };
}
interface LoginData { email: string; password: string; }
interface RegisterData { username: string; email: string; password: string; }
interface EmailCheckResponse { message: string; data: { exists: boolean; }; }

// (Giữ nguyên các hàm auth này - bạn nói không cần sửa sendOtp/checkEmail thì tôi giữ lại cách gửi string)
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
  const response = await authApi.post('/send-otp', email ); // Giữ nguyên theo yêu cầu
  return response.data;
};
export const verifyOtp = async (email: string, otpCode: string): Promise<{
  message: string;
  data?: { user: { userId: number; username: string; email: string; }; token: string; };
}> => {
  const response = await authApi.post('/verify-otp', { email, otpCode });
  if (response.data.data?.token && response.data.data?.user?.userId) {
    await AsyncStorage.setItem('token', response.data.data.token);
    await AsyncStorage.setItem('userId', response.data.data.user.userId.toString());
  }
  return response.data;
};
export const checkEmail = async (email: string): Promise<EmailCheckResponse> => {
  const response = await authApi.post('/check-email', email ); // Giữ nguyên theo yêu cầu
  return response.data;
};


// --- USER TYPES --- (ĐẢM BẢO CÁC INTERFACE NÀY ĐƯỢC ĐỊNH NGHĨA Ở ĐÂY)
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

export interface ExpoImageFile {
  uri: string;
  name: string;
  type: string;
}

export interface UserProfileCreationData {
  username: string;
  password?: string;
  fullName?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  bio?: string | null;
  phoneNumber?: string | null;
  email?: string;
  profileVisibility?: number | null;
  address?: string | null;
}

export interface UserProfileModificationData {
  fullName?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  bio?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  profileVisibility?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

// --- USER FUNCTIONS ---
export const getUserByEmail = async (email: string): Promise<ApiUser | null> => {
  try {
    const response = await userApi.get<ApiUser>('/by-email', { params: { email } });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

export const getUserById = async (userId: number): Promise<ApiUser | null> => {
  try {
    const response = await userApi.get<ApiUser>(`/${userId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

export const getUsersForSwiping = async (params: { pageNumber: number; pageSize: number }): Promise<ApiUserCard[]> => {
  try {
    const queryString = `?pageNumber=${params.pageNumber}&pageSize=${params.pageSize}`;
    console.log(`[getUsersForSwiping] Requesting: ${userApi.defaults.baseURL}${queryString}`); // Log URL
    const response = await userApi.get<ApiUserCard[]>(queryString); // Gửi query string
    return response.data;
  } catch (error: any) {
    console.error(`[ERROR getUsersForSwiping] Failed to fetch users for page ${params.pageNumber}. Status: ${error.response?.status}`, error.response?.data || error.message);
    throw error;
  }
};

export const updateUserProfile = async (
  userId: number,
  updates: UserProfileModificationData,
  avatarFile?: ExpoImageFile | null
): Promise<void> => {
  const formData = new FormData();
  (Object.keys(updates) as Array<keyof UserProfileModificationData>).forEach(key => {
    const value = updates[key];
    if (value !== undefined && value !== null) {
        if (key === 'birthdate' && value) {
            formData.append(key, new Date(value as string).toISOString());
        } else {
            formData.append(key, String(value));
        }
    }
  });
  if (avatarFile) {
    formData.append('avatarFile', {
      uri: avatarFile.uri,
      name: avatarFile.name,
      type: avatarFile.type,
    } as any);
  }
  try {
    const response = await userApi.put(`/${userId}`, formData);
    if (response.status !== 204) {
      console.warn(`updateUserProfile: Expected 204, got ${response.status}`);
    }
  } catch (error) {
    throw error;
  }
};

export const createUserWithProfileDetails = async ( // Đã bỏ comment nếu bạn dùng
  userData: UserProfileCreationData,
  avatarFile?: ExpoImageFile | null
): Promise<ApiUser> => { // Sửa kiểu trả về
  const formData = new FormData();
  (Object.keys(userData) as Array<keyof UserProfileCreationData>).forEach(key => {
    const value = userData[key];
    if (value !== undefined && value !== null) {
      if (key === 'birthdate' && value) {
        formData.append(key, new Date(value as string).toISOString());
      } else {
        formData.append(key, String(value));
      }
    }
  });

  if (avatarFile) {
    formData.append('avatarFile', {
      uri: avatarFile.uri,
      name: avatarFile.name,
      type: avatarFile.type,
    } as any);
  }

  try {
    const response = await userApi.post<ApiUser>('/', formData); // Thêm kiểu generic
    return response.data;
  } catch (error) {
    throw error;
  }
};

// --- SWIPE TYPES & FUNCTIONS ---
export interface SwipeCreateDTO { toUserID: number; isLike: boolean; }
export interface SwipeMatchResponse { message: string; isMatch: boolean; matchedWithUser?: MatchedUserDetails;} // Sử dụng MatchedUserDetails

export const createSwipe = async (data: SwipeCreateDTO): Promise<SwipeMatchResponse> => {
  try {
    const response = await swipeApi.post<SwipeMatchResponse>('/createswipe', data, {
        headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

// --- INTEREST TYPES & FUNCTIONS ---
export interface Interest { interestId: number; interestName: string; }

export const getAllInterests = async (): Promise<Interest[]> => {
  try {
    const response = await interestApi.get<Interest[]>('/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getUserInterests = async (userId: number): Promise<Interest[]> => {
  try {
    const response = await userApi.get<Interest[]>(`/${userId}/interests`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

export const saveUserInterests = async (userId: number, interestIds: number[]): Promise<string> => {
  try {
    const response = await userApi.post<string>(`/${userId}/interests`, interestIds, {
        headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

// --- MEDIA TYPES & FUNCTIONS ---
export interface UploadedMediaResponse {
  url: string; // URL tương đối của file đã upload
}

// Tạo một instance Axios mới cho MediaController nếu cần headers khác
// Hoặc bạn có thể dùng userApi nếu headers giống nhau và chỉ thay đổi Content-Type khi cần
const mediaApi = axios.create({
  baseURL: `${API_BASE_URL}/api/Media`, // Trỏ đến MediaController
});
mediaApi.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Khi upload file, Content-Type sẽ là 'multipart/form-data' và được Axios tự xử lý khi data là FormData
  return config;
});

export const uploadChatMedia = async (file: ExpoImageFile): Promise<UploadedMediaResponse> => {
  const formData = new FormData();
  formData.append('file', { // Tên 'file' phải khớp với tham số IFormFile ở backend
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  try {
    console.log(`[uploadChatMedia] Uploading file: ${file.name}, type: ${file.type}`);
    const response = await mediaApi.post<UploadedMediaResponse>('/upload/chat-media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Explicitly set for FormData
      },
    });
    console.log('[uploadChatMedia] Upload successful, URL:', response.data.url);
    return response.data;
  } catch (error: any) {
    console.error('[uploadChatMedia] Error uploading file:', error.response?.data || error.message);
    throw error;
  }
};


// --- MESSAGE TYPES & FUNCTIONS ---
// Enum này nên đồng bộ với backend (C# enum)
export enum MessageTypeEnum {
  Text = 0,
  Image = 1,
  Video = 2,
}

export interface MessageDTO {
  messageID: number;
  matchID: number;
  senderUserID: number;
  senderFullName?: string | null; // Thêm từ backend
  senderAvatar?: string | null;   // Thêm từ backend
  receiverUserID: number;
  content: string;
  timestamp: string; // Dạng ISO string
  isRead: boolean;
  isMe: boolean; // Client tự xác định dựa trên senderUserID
  type: MessageTypeEnum;
  mediaUrl?: string | null;
}

export interface SendMessageDTO {
  matchID: number;
  content: string; // Có thể là caption cho media
  type: MessageTypeEnum;
  mediaUrl?: string | null; // URL sau khi upload media
}

export interface ConversationPreviewDTO {
  matchID: number;
  matchedUserID: number;
  matchedUsername?: string | null;
  matchedUserAvatar?: string | null;
  lastMessageContent?: string | null;
  lastMessageTimestamp?: string | null; // Dạng ISO string
  unreadCount: number;
  isLastMessageFromMe: boolean;
  isMatchedUserOnline?: boolean; // Thêm dấu ? nếu backend có thể không gửi (dù nên gửi)
  matchedUserLastSeen?: string | null; // Dạng ISO string
}

// Tạo một instance Axios mới cho MessagesController
const messagesApi = axios.create({
  baseURL: `${API_BASE_URL}/api/Messages`,
});
messagesApi.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const sendMessage = async (data: SendMessageDTO): Promise<MessageDTO> => {
  try {
    const response = await messagesApi.post<MessageDTO>('/send', data);
    return response.data;
  } catch (error: any) {
    console.error('[sendMessage] Error sending message:', error.response?.data || error.message);
    throw error;
  }
};

export const getMessagesForMatch = async (matchId: number, pageNumber: number = 1, pageSize: number = 20): Promise<MessageDTO[]> => {
  try {
    const response = await messagesApi.get<MessageDTO[]>(`/match/${matchId}`, {
      params: { pageNumber, pageSize },
    });
    return response.data;
  } catch (error: any) {
    console.error(`[getMessagesForMatch] Error fetching messages for match ${matchId}:`, error.response?.data || error.message);
    throw error;
  }
};

export const getConversationPreviews = async (): Promise<ConversationPreviewDTO[]> => {
  try {
    const response = await messagesApi.get<ConversationPreviewDTO[]>('/conversations');
    return response.data;
  } catch (error: any) {
    console.error('[getConversationPreviews] Error fetching conversations:', error.response?.data || error.message);
    throw error;
  }
};

export const markMessagesAsRead = async (matchId: number): Promise<{ message: string }> => {
  try {
    const response = await messagesApi.post<{ message: string }>(`/match/${matchId}/read`);
    return response.data;
  } catch (error: any) {
    console.error(`[markMessagesAsRead] Error marking messages as read for match ${matchId}:`, error.response?.data || error.message);
    throw error;
  }
};

export default authApi;