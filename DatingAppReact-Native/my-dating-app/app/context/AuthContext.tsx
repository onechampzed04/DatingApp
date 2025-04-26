import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AuthContextType {
  user: any;
  login: (userData: any) => void;
  logout: () => void;
  register: (data: { email: string; password: string; otp: string }) => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState(null);

  // Giả sử bạn sẽ kiểm tra token từ async storage ở đây
  useEffect(() => {
    const loadUser = async () => {
      // load từ AsyncStorage hoặc SecureStore
      const savedUser = null; // logic load user ở đây
      if (savedUser) setUser(savedUser);
    };
    loadUser();
  }, []);

  const login = (userData: any) => {
    setUser(userData);
    // Lưu vào storage nếu cần
  };
  const register = async ({ email, password, otp }: { email: string; password: string; otp: string }) => {
    // TODO: Viết logic register ở đây
  };
  
  const logout = () => {
    setUser(null);
    // Xóa khỏi storage nếu cần
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
