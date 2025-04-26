import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function OtpScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [otp, setOtp] = useState(['', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    const lastChar = text.slice(-1); // Lấy ký tự cuối nếu dán nhiều
  
    if (!/^[a-zA-Z0-9]?$/.test(lastChar)) return; // Tùy ý lọc ký tự hợp lệ
  
    newOtp[index] = lastChar;
    setOtp(newOtp);
  
    if (lastChar && index < otp.length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };  
  
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const newOtp = [...otp];
  
      if (otp[index] === '') {
        // Ô hiện tại trống -> quay lại ô trước nếu có
        if (index > 0) {
          newOtp[index - 1] = '';
          setOtp(newOtp);
          inputs.current[index - 1]?.focus();
        }
      } else {
        // Ô hiện tại có ký tự -> xóa nó
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };
  
  
  const handleVerify = () => {
    const fullOtp = otp.join('');
    const correctOtp = '9999';
    if (fullOtp === correctOtp) {
      router.replace('/(auth)/login');
    } else {
      Alert.alert('Sai mã OTP', 'Vui lòng kiểm tra lại.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Xác minh mã OTP</Text>
      <Text style={styles.subtitle}>Nhập mã gồm 4 chữ số được gửi tới số của bạn</Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputs.current[index] = ref)}
            style={[
              styles.otpInput,
              digit ? styles.otpFilled : null,
              inputs.current[index]?.isFocused?.() ? styles.otpFocused : null,
            ]}
            keyboardType="numeric"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            textAlign="center"
            onFocus={() => setOtp([...otp])}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleVerify}>
        <Text style={styles.buttonText}>Xác nhận</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

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
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 16,
    fontSize: 28,
    color: '#000',
    backgroundColor: '#fff',
  },
  otpFocused: {
    borderColor: '#EB3C58',
  },
  otpFilled: {
    borderColor: '#EB3C58',
  },
  button: {
    backgroundColor: '#EB3C58',
    paddingVertical: 16,
    borderRadius: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
});
