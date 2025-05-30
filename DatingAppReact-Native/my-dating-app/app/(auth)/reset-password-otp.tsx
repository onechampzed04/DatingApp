import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { sendForgotPasswordOtp, resetPasswordWithOtp, ApiUser, getUserByEmail } from '../../utils/api'; // Assuming resetPasswordWithOtp returns user and token

export default function ResetPasswordOtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { setAuthenticatedSession } = useAuth();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const otpInputs = useRef<Array<TextInput | null>>([]);

  const handleRequestOtp = async (isResend: boolean = false) => {
    if (!email) {
      Alert.alert('Lỗi', 'Không tìm thấy địa chỉ email.');
      return;
    }
    if (isResend && resendDisabled) return;

    setOtpSending(true);
    setLoading(isResend); // Only show main loader on resend, not initial send

    try {
      await sendForgotPasswordOtp(email);
      Alert.alert('Thành công', `Mã OTP đã được gửi đến ${email}`);
      setResendDisabled(true);
      setCountdown(60);
      otpInputs.current[0]?.focus();
    } catch (error: any) {
      console.error('Lỗi gửi OTP:', error);
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể gửi OTP. Vui lòng thử lại.');
    } finally {
      setOtpSending(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRequestOtp(); // Request OTP when screen loads
  }, [email]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (resendDisabled && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    } else if (countdown === 0) {
      setResendDisabled(false);
      setCountdown(60);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendDisabled, countdown]);

  const handleOtpChange = (text: string, index: number) => {
    if (!/^[0-9]?$/.test(text)) return;
    const newOtpArray = [...otp];
    newOtpArray[index] = text;
    setOtp(newOtpArray);

    if (text && index < otp.length - 1) {
      otpInputs.current[index + 1]?.focus();
    }
    if (text && index === otp.length - 1) {
        Keyboard.dismiss();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const newOtpArray = [...otp];
      if (otp[index] === '' && index > 0) {
        otpInputs.current[index - 1]?.focus();
        newOtpArray[index-1] = '';
      } else {
        newOtpArray[index] = '';
      }
      setOtp(newOtpArray);
    }
  };

  const handleSubmit = async () => {
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      Alert.alert('Lỗi', 'Vui lòng nhập đủ 6 số OTP.');
      return;
    }
    if (!newPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu mới.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Lỗi', 'Mật khẩu mới và xác nhận không khớp.');
      return;
    }
    if (!email) {
      Alert.alert('Lỗi', 'Không tìm thấy địa chỉ email.');
      return;
    }

    setLoading(true);
    try {
      const response = await resetPasswordWithOtp({
        email,
        otpCode: fullOtp,
        newPassword,
      });
      
      Alert.alert('Thành công', response.message || 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập.', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/(auth)/login_email', params: { email } }) },
      ]);

    } catch (error: any) {
      console.error('Lỗi đặt lại mật khẩu:', error);
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButtonHeader}>
        <Text style={styles.backButtonHeaderText}>Quay lại</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Đặt lại mật khẩu</Text>
      <Text style={styles.subtitle}>
        Một mã OTP đã được gửi đến <Text style={{ fontWeight: 'bold' }}>{email || 'email của bạn'}</Text>.
        Nhập mã OTP và mật khẩu mới.
      </Text>

      <Text style={styles.label}>Mã OTP</Text>
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (otpInputs.current[index] = ref)}
            style={[styles.otpInput, digit ? styles.otpFilled : null]}
            keyboardType="numeric"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={(e) => handleOtpKeyPress(e, index)}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>
      <TouchableOpacity onPress={() => handleRequestOtp(true)} disabled={resendDisabled || otpSending || loading} style={styles.resendButton}>
        <Text style={[styles.resendText, (resendDisabled || otpSending || loading) && styles.resendDisabledText]}>
          {otpSending && !loading ? 'Đang gửi...' : (resendDisabled ? `Gửi lại OTP (${countdown}s)` : 'Gửi lại OTP')}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Mật khẩu mới</Text>
      <TextInput
        style={styles.input}
        placeholder="Nhập mật khẩu mới"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        placeholderTextColor="#888"
      />
      <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
      <TextInput
        style={styles.input}
        placeholder="Nhập lại mật khẩu mới"
        secureTextEntry
        value={confirmNewPassword}
        onChangeText={setConfirmNewPassword}
        placeholderTextColor="#888"
      />

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading || otpSending}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đặt lại mật khẩu</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  backButtonHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    zIndex: 1,
  },
  backButtonHeaderText: {
    fontSize: 16,
    color: '#f14c64',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#666',
    marginBottom: 28,
    lineHeight: 22,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10, // Reduced margin
  },
  otpInput: {
    width: 48,
    height: 58,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 10,
    fontSize: 26,
    color: '#333',
    backgroundColor: '#f9f9f9',
    textAlign: 'center',
  },
  otpFilled: {
    borderColor: '#f14c64',
    backgroundColor: '#fff5f7',
  },
  button: {
    backgroundColor: '#f14c64',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    height: 52,
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#f8a9b6',
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  resendButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginBottom: 20,
  },
  resendText: {
    color: '#f14c64',
    fontSize: 15,
    fontWeight: '500',
  },
  resendDisabledText: {
    color: '#aaa',
  },
});
