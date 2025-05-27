// login_email.tsx
// ... (các phần import và khai báo state giữ nguyên)
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { checkEmail } from '../../utils/api';


export default function LoginWithEmail() {
  const { loginUser, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // const [otp, setOtp] = useState(''); // OTP không còn được quản lý ở đây nếu luồng chính là qua context
  const [loading, setLoading] = useState(false);
  // const [otpLoading, setOtpLoading] = useState(false); // Tương tự, otpLoading có thể không cần thiết

  const handleCheckEmail = async () => {
    if (!email) {
      Alert.alert('Lỗi', 'Vui lòng nhập email');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Lỗi', 'Vui lòng nhập đúng định dạng email');
      return;
    }
    setLoading(true);
    try {
      const response = await checkEmail(email);
      if (response.data.exists) {
        setStep('login');
      } else {
        setStep('register');
      }
    } catch (err) {
      console.error('Error checking email:', err);
      const errorMessage = (err as any)?.response?.data?.message || 'Không thể kiểm tra email';
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ĐÂY LÀ HÀM handleLogin ĐÃ CẬP NHẬT
  const handleLogin = async () => {
    if (!password) {
      Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu');
      return;
    }
    setLoading(true);
    try {
      await loginUser({ email, password });
      // KHÔNG còn router.replace ở đây. AuthContext.loginUser sẽ xử lý điều hướng.
    } catch (err) {
      const message = (err as any)?.response?.data?.message || 'Đăng nhập thất bại';
      Alert.alert('Lỗi', message);
      
      // Đoạn này có thể vẫn hữu ích như một fallback nếu loginUser ném lỗi cụ thể
      if (message.includes('Email not verified') || message.includes('chưa xác thực')) {
        // Cân nhắc: có nên gửi OTP từ đây không nếu loginUser thất bại sớm?
        // Hiện tại, AuthContext.loginUser được thiết kế để xử lý gửi OTP.
        // Nếu loginUser trong context bị lỗi trước khi kiểm tra isEmailVerified,
        // thì có thể thêm logic gửi OTP ở đây và điều hướng.
        // await sendOtp(email); // Cân nhắc
        // router.push({ pathname: '/(auth)/otp', params: { email } }); // Cân nhắc
      }
    } finally {
      setLoading(false);
    }
  };

  // ĐÂY LÀ HÀM handleRegister ĐÃ CẬP NHẬT
  const handleRegister = async () => {
    if (!username) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên người dùng');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu không khớp');
      return;
    }
    setLoading(true);
    try {
      await register({ username, email, password });
      // KHÔNG còn router.push ở đây. AuthContext.register sẽ xử lý điều hướng.
    } catch (err) {
      const errorMessage = (err as any)?.response?.data?.message || 'Đăng ký thất bại';
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Hàm handleSendOtp này có thể không còn cần thiết nếu luồng chính là
  // AuthContext gửi OTP và điều hướng. Nó có thể hữu ích cho trường hợp người dùng
  // muốn tự gửi lại OTP từ màn hình này (nếu bạn có UI cho việc đó).
  /*
  const handleSendOtp = async () => {
    setOtpLoading(true);
    try {
      await sendOtp(email);
      Alert.alert('Thành công', 'OTP đã được gửi đến email của bạn');
    } catch (err) {
      const errorMessage = (err as any)?.response?.data?.message || 'Không thể gửi OTP';
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setOtpLoading(false);
    }
  };
  */

  const handleBack = () => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    // setOtp(''); // Không cần nếu OTP không quản lý ở đây
  };

  // ... (Phần JSX của component không thay đổi, bạn giữ nguyên)
  if (step === 'email') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Đăng nhập bằng email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleCheckEmail} 
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tiếp tục</Text>}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'login') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Đăng nhập</Text>
        <Text style={styles.emailText}>{email}</Text>
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin} 
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.forgotButton}>
          <Text style={styles.forgotText}>Quên mật khẩu?</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBack}
        >
          <Text style={styles.backButtonText}>Đổi email</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'register') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Đăng ký tài khoản</Text>
        <Text style={styles.emailText}>{email}</Text>
        <TextInput
          style={styles.input}
          placeholder="Tên người dùng"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Nhập lại mật khẩu"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleRegister} 
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng ký</Text>}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBack}
        >
          <Text style={styles.backButtonText}>Đổi email</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 32,
    color: '#f14c64',
  },
  emailText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 24,
    color: '#666',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 16,
    fontSize: 16,
  },
  // otpContainer, otpInput, sendOtpButton, sendOtpButtonText không còn thực sự cần thiết ở đây
  // nếu luồng chính đã chuyển sang AuthContext và màn hình OTP riêng.
  button: {
    backgroundColor: '#f14c64',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    height: 54,
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotText: {
    color: '#f14c64',
    fontSize: 16,
  },
});