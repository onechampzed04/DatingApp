import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { verifyOtp, sendOtp, getUserByEmail } from '../../utils/api';
import { useAuth } from '../context/AuthContext';

export default function OtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { setAuthenticatedSession, token: authTokenFromContext } = useAuth(); // Lấy token từ context
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const hasVerifiedThisSession = useRef(false); // Cờ mới: Đã xác thực thành công trong phiên này của màn hình OTP chưa?
  const verifyApiCallInProgres = useRef(false); // Cờ mới: API call verifyOtp đang chạy?

  useEffect(() => {
    // Nếu đã có token từ AuthContext VÀ đã xác thực thành công trong phiên này,
    // có thể người dùng quay lại màn hình này sau khi đã xác thực. Điều hướng đi.
    // Điều này giúp tránh kẹt ở OTP nếu user back lại sau khi đã vào /gender
    if (authTokenFromContext && hasVerifiedThisSession.current) {
      console.log('[OtpScreen] Token exists and OTP was verified this session, redirecting from useEffect.');
      // router.replace('/gender'); // Hoặc route phù hợp
      // Cân nhắc: Có thể không cần thiết nếu AuthLayout đã xử lý tốt.
      // Nếu bạn vẫn thấy lỗi Axious verify, có thể AuthLayout vẫn cho render OtpScreen
      // và OtpScreen lại cố verify.
    }
  }, [authTokenFromContext, router]);


  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (resendDisabled && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    if (countdown === 0) {
      setResendDisabled(false);
      setCountdown(60);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendDisabled, countdown]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const handleVerify = async (currentFullOtpFromChange?: string) => {
    if (verifyApiCallInProgres.current || hasVerifiedThisSession.current) {
      console.log(`Skipping handleVerify: API call in progress=${verifyApiCallInProgres.current}, Has verified this session=${hasVerifiedThisSession.current}`);
      return;
    }

    const fullOtpToVerify = currentFullOtpFromChange || otp.join('');

    if (fullOtpToVerify.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    verifyApiCallInProgres.current = true;
    Keyboard.dismiss();

    try {
      console.log('[OtpScreen] Sending verifyOtp request:', { email, fullOtp: fullOtpToVerify });
      const response = await verifyOtp(email as string, fullOtpToVerify);
      console.log('[OtpScreen] verifyOtp response:', response);

      if (response.message === 'OTP verified successfully.' && response.data?.user && response.data?.token) {
        hasVerifiedThisSession.current = true; // Đánh dấu đã xác thực thành công
        await setAuthenticatedSession(
          {
            userId: response.data.user.userId,
            username: response.data.user.username,
            email: response.data.user.email,
          },
          response.data.token
        );
        Alert.alert(
          'Success',
          'Email verification successful.',
          [{ text: 'OK', onPress: () => router.replace('/gender') }]
        );
      } else {
        // Backend trả về success false hoặc data không đúng cấu trúc
        throw new Error(response.message || 'Invalid OTP response structure from server.');
      }
    } catch (err: any) {
      console.error('[OtpScreen] OTP verification error:', err.response?.data || err.message, err);
      // Lỗi Axios (ví dụ 400 - OTP sai/hết hạn, 500 - lỗi server, etc.) sẽ rơi vào đây
      // hasVerifiedThisSession.current sẽ vẫn là false, cho phép thử lại OTP khác.

      let alertMessage = 'Failed to verify OTP. Please try again.';
      if (err.response?.data?.message) {
        alertMessage = err.response.data.message; // Ưu tiên thông báo lỗi từ backend
      } else if (err.message) {
        // Tránh hiển thị thông báo lỗi kỹ thuật nếu có thể
        if (!err.message.toLowerCase().includes('network request failed') &&
            !err.message.toLowerCase().includes('timeout') &&
            !err.message.includes('Invalid OTP response structure')) {
             // Chỉ hiển thị err.message nếu nó không phải là lỗi mạng chung chung
             // hoặc lỗi cấu trúc tự định nghĩa.
        }
      }
       Alert.alert('Error', alertMessage);

      // Bỏ qua việc gọi getUserByEmail ở đây để đơn giản hóa luồng lỗi.
      // Người dùng nên thử lại OTP hoặc resend.
      // Nếu OTP đúng nhưng token không được tạo, đó là vấn đề của backend.
    } finally {
      setLoading(false);
      verifyApiCallInProgres.current = false;
      // Không reset hasVerifiedThisSession.current ở đây. Nó chỉ reset khi resend OTP hoặc component unmount.
    }
  };

  const handleChange = (text: string, index: number) => {
    if (!/^[0-9]?$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < otp.length - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (text && index === otp.length - 1) {
      const currentFullOtp = newOtp.join('');
      const isComplete = newOtp.every(digit => digit.length === 1); // Chính xác hơn là !== ''

      if (isComplete && currentFullOtp.length === 6) {
        // Keyboard.dismiss(); // Chuyển vào handleVerify
        setTimeout(() => {
          // Chỉ gọi nếu chưa xác thực thành công TRONG PHIÊN NÀY và không có API call nào đang chạy
          if (!hasVerifiedThisSession.current && !verifyApiCallInProgres.current) {
            handleVerify(currentFullOtp);
          }
        }, 300);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const newOtp = [...otp];
      if (otp[index] === '') {
        if (index > 0) {
          newOtp[index - 1] = '';
          setOtp(newOtp);
          inputs.current[index - 1]?.focus();
        }
      } else {
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  const handleResendOtp = async () => {
    if (resendDisabled || loading || verifyApiCallInProgres.current) return;

    setLoading(true);
    hasVerifiedThisSession.current = false; // Quan trọng: Reset cờ này
    verifyApiCallInProgres.current = false; // Đảm bảo cờ này cũng false
    setOtp(['', '', '', '', '', '']);
    inputs.current[0]?.focus();

    try {
      console.log('[OtpScreen] Sending resendOtp request for email:', email);
      await sendOtp(email as string);
      Alert.alert('Success', `A new OTP has been sent to ${email}`);
      setResendDisabled(true);
      setCountdown(60);
    } catch (err: any) {
      console.error('[OtpScreen] Resend OTP error:', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // JSX (đảm bảo không có text trần)
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.subtitle}>
        <Text>Enter the 6-digit code sent to </Text>
        <Text style={{ fontWeight: 'bold' }}>{email || 'your email'}</Text>
      </Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputs.current[index] = ref)}
            style={[
              styles.otpInput,
              digit ? styles.otpFilled : null,
            ]}
            keyboardType="numeric"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>

      <TouchableOpacity
        style={[
            styles.button,
            (loading || verifyApiCallInProgres.current || hasVerifiedThisSession.current) && styles.buttonDisabled
        ]}
        onPress={() => {
            if(!hasVerifiedThisSession.current && !verifyApiCallInProgres.current){ // Kiểm tra kỹ hơn
                 handleVerify();
            }
        }}
        disabled={loading || verifyApiCallInProgres.current || hasVerifiedThisSession.current || otp.join('').length !== 6}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleResendOtp}
        disabled={resendDisabled || loading || verifyApiCallInProgres.current}
        style={styles.resendButton}
      >
        <Text style={[
          styles.resendText,
          (resendDisabled || loading || verifyApiCallInProgres.current) && styles.resendDisabled,
        ]}>
          {resendDisabled
            ? `Resend OTP (${countdown}s)`
            : 'Resend OTP'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(auth)/login'); // Hoặc màn hình phù hợp
            }
        }}
        style={styles.backButton}
        disabled={loading || verifyApiCallInProgres.current} // Disable khi đang có action
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

// Styles giữ nguyên
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: { // Đã sửa: bọc các phần text con bên trong <Text>
    fontSize: 16,
    textAlign: 'center',
    color: '#777',
    marginBottom: 32,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 12,
    fontSize: 28,
    color: '#000',
    backgroundColor: '#f8f8f8',
    textAlign: 'center',
  },
  otpFilled: {
    borderColor: '#EB3C58',
  },
  button: {
    backgroundColor: '#EB3C58',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#f9a7b5',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendButton: {
    paddingVertical: 8,
    alignSelf: 'center',
  },
  resendText: {
    color: '#EB3C58',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  resendDisabled: {
    color: '#999',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  backButtonText: {
    color: '#555',
    textAlign: 'center',
    fontSize: 16,
  }
});