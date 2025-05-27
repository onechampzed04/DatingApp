// app/(auth)/otp.tsx
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
import { verifyOtp, sendOtp, getUserByEmail, ApiUser } from '../../utils/api'; // << THÊM ApiUser
import { useAuth } from '../context/AuthContext'; // << Đảm bảo đây là useAuth từ context của bạn

export default function OtpScreen() {
  const router = useRouter();
  const { email: emailFromParams } = useLocalSearchParams<{ email: string }>(); // Đổi tên để tránh nhầm lẫn
  const { setAuthenticatedSession, token: authTokenFromContext } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const hasVerifiedThisSession = useRef(false);
  const verifyApiCallInProgres = useRef(false);

  // ... (useEffect cho authTokenFromContext và timer giữ nguyên) ...
    useEffect(() => {
        if (authTokenFromContext && hasVerifiedThisSession.current) {
        console.log('[OtpScreen] Token exists and OTP was verified this session, redirecting from useEffect.');
        // Cân nhắc điều hướng ở đây nếu AuthLayout không xử lý kịp
        // router.replace('/(setup)/gender'); // Ví dụ
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
    const currentEmail = emailFromParams as string; // Lấy email từ params

    if (!currentEmail) {
        Alert.alert('Error', 'Email not found. Cannot verify OTP.');
        return;
    }

    if (fullOtpToVerify.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    verifyApiCallInProgres.current = true;
    Keyboard.dismiss();

    try {
      console.log('[OtpScreen] Sending verifyOtp request:', { email: currentEmail, fullOtp: fullOtpToVerify });
      const verifyResponse = await verifyOtp(currentEmail, fullOtpToVerify);
      console.log('[OtpScreen] verifyOtp response:', verifyResponse);

      if (verifyResponse.message === 'OTP verified successfully.' && verifyResponse.data?.user && verifyResponse.data?.token) {
        // OTP đúng, token được tạo. Giờ fetch thông tin user đầy đủ.
        const basicUserInfoFromOtp = verifyResponse.data.user;
        const newAuthToken = verifyResponse.data.token;

        console.log('[OtpScreen] OTP verified. Fetching full user details for:', basicUserInfoFromOtp.email);
        const fullUserDetails: ApiUser | null = await getUserByEmail(basicUserInfoFromOtp.email);

        if (!fullUserDetails) {
          // Đây là trường hợp lạ: OTP đúng, user có trong verifyOtp response, nhưng getUserByEmail không tìm thấy
          // Hoặc user đã bị xóa ngay sau khi verify OTP.
          throw new Error(`User details for ${basicUserInfoFromOtp.email} not found after successful OTP verification.`);
        }
        console.log('[OtpScreen] Full user details fetched:', fullUserDetails);

        hasVerifiedThisSession.current = true; // Đánh dấu đã xác thực thành công

        // Gọi setAuthenticatedSession với thông tin đầy đủ
        await setAuthenticatedSession(
          { // Object này phải khớp với interface User trong AuthContext
            userId: fullUserDetails.userID, // từ fullUserDetails
            username: fullUserDetails.username, // từ fullUserDetails
            email: fullUserDetails.email, // từ fullUserDetails
            avatar: fullUserDetails.avatar, // từ fullUserDetails
            fullName: fullUserDetails.fullName, // từ fullUserDetails
          },
          newAuthToken // Token mới từ verifyResponse
        );

        Alert.alert(
          'Success',
          'Email verification successful.',
          // Điều hướng sau khi Alert được nhấn OK
          [{ text: 'OK', onPress: () => router.replace('/(setup)/gender') }] // Đổi thành (setup)/gender
        );
      } else {
        // Backend trả về success false hoặc data không đúng cấu trúc từ verifyOtp
        throw new Error(verifyResponse.message || 'Invalid OTP response structure from server.');
      }
    } catch (err: any) {
      console.error('[OtpScreen] OTP verification or subsequent user fetch error:', err.response?.data || err.message, err);
      let alertMessage = 'Failed to verify OTP or process session. Please try again.';
      if (err.response?.data?.message) {
        alertMessage = err.response.data.message;
      } else if (err.message && !err.message.toLowerCase().includes('network request failed') && !err.message.toLowerCase().includes('timeout')) {
        // Chỉ hiển thị err.message nếu nó không phải là lỗi mạng chung chung
        // hoặc lỗi tự định nghĩa.
         if (err.message !== 'Invalid OTP response structure from server.' && !err.message.startsWith('User details for')) {
            // alertMessage = err.message; // Bỏ comment nếu muốn hiển thị lỗi cụ thể hơn
         }
      }
      Alert.alert('Error', alertMessage);
    } finally {
      setLoading(false);
      verifyApiCallInProgres.current = false;
    }
  };

  // ... (các hàm handleChange, handleKeyPress, handleResendOtp giữ nguyên) ...
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
        // Chính xác hơn là !== '' hoặc kiểm tra length
        const isComplete = newOtp.every(digit => digit.length === 1); 

        if (isComplete && currentFullOtp.length === 6) {
            setTimeout(() => {
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
        const currentEmail = emailFromParams as string;
        if (!currentEmail) {
             Alert.alert('Error', 'Email not found. Cannot resend OTP.');
             return;
        }

        setLoading(true);
        hasVerifiedThisSession.current = false; 
        verifyApiCallInProgres.current = false; 
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();

        try {
        console.log('[OtpScreen] Sending resendOtp request for email:', currentEmail);
        await sendOtp(currentEmail);
        Alert.alert('Success', `A new OTP has been sent to ${currentEmail}`);
        setResendDisabled(true);
        setCountdown(60);
        } catch (err: any) {
        console.error('[OtpScreen] Resend OTP error:', err.response?.data || err.message);
        Alert.alert('Error', err.response?.data?.message || 'Failed to resend OTP. Please try again.');
        } finally {
        setLoading(false);
        }
    };

  // ... (JSX giữ nguyên) ...
  return (
    <KeyboardAvoidingView
    style={styles.container}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
    <Text style={styles.title}>Verify Your Email</Text>
    <Text style={styles.subtitle}>
        <Text>Enter the 6-digit code sent to </Text>
        <Text style={{ fontWeight: 'bold' }}>{emailFromParams || 'your email'}</Text>
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
            if(!hasVerifiedThisSession.current && !verifyApiCallInProgres.current){ 
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
                router.replace('/(auth)/login'); 
            }
        }}
        style={styles.backButton}
        disabled={loading || verifyApiCallInProgres.current}
    >
        <Text style={styles.backButtonText}>Back</Text>
    </TouchableOpacity>
    </KeyboardAvoidingView>
);
}
// ... (styles giữ nguyên)
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
subtitle: {
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