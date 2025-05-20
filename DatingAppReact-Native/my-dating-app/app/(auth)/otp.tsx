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
import { useAuth } from '../context/AuthContext'; // Thêm useAuth

export default function OtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { setAuthenticatedSession } = useAuth(); // Thêm setAuthenticatedSession
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(60);

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

  const handleChange = (text: string, index: number) => {
    if (!/^[0-9]?$/.test(text)) return;
    
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    
    if (text && index < otp.length - 1) {
      inputs.current[index + 1]?.focus();
    }
    
    if (text && index === otp.length - 1) {
      const isComplete = newOtp.every(digit => digit !== '');
      if (isComplete) {
        Keyboard.dismiss();
        setTimeout(() => handleVerify(), 300);
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

  const handleVerify = async () => {
  const fullOtp = otp.join('');
  if (fullOtp.length !== 6) {
    Alert.alert('Error', 'Please enter the 6-digit OTP code');
    return;
  }
  
  setLoading(true);
  try {
    console.log('Sending verifyOtp request:', { email, fullOtp });
    const response = await verifyOtp(email as string, fullOtp);
    console.log('verifyOtp response:', response);

    if (response.message === 'OTP verified successfully.' && response.data?.user && response.data?.token) {
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
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/habit') }]
      );
    } else {
      throw new Error(response.message || 'Invalid OTP response');
    }
  } catch (err: any) {
    console.error('OTP verification error:', err.response?.data, err.message);
    try {
      const userData = await getUserByEmail(email as string);
      console.log('User data after OTP verification:', userData);
      if (userData?.isEmailVerified) {
        // OTP đã được xác thực, nhưng không có token
        await setAuthenticatedSession(
          {
            userId: userData.userID,
            username: userData.username,
            email: userData.email,
          },
          ''
        );
        Alert.alert(
          'Success', 
          'Email verification successful, but token generation failed. Please log in again.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      } else {
        Alert.alert('Error', err.response?.data?.message || 'Failed to verify OTP. Please try again.');
      }
    } catch (userErr) {
      console.error('Error checking user status:', userErr);
      Alert.alert('Error', err.response?.data?.message || 'Failed to verify OTP. Please try again.');
    }
  } finally {
    setLoading(false);
  }
};

  const handleResendOtp = async () => {
    if (resendDisabled) return;
    
    setLoading(true);
    try {
      await sendOtp(email as string);
      Alert.alert('Success', `OTP has been sent to ${email}`);
      setResendDisabled(true);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>

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
          />
        ))}
      </View>

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleVerify} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={handleResendOtp} 
        disabled={resendDisabled || loading}
        style={styles.resendButton}
      >
        <Text style={[
          styles.resendText,
          resendDisabled && styles.resendDisabled
        ]}>
          {resendDisabled 
            ? `Resend OTP (${countdown}s)` 
            : 'Resend OTP'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.backButtonText}>Back to Login</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

// Giữ nguyên styles như cũ
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
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  resendButton: {
    marginTop: 16,
    padding: 8,
  },
  resendText: {
    color: '#EB3C58',
    textAlign: 'center',
    fontSize: 16,
  },
  resendDisabled: {
    color: '#999',
  },
  backButton: {
    marginTop: 16,
    padding: 8,
  },
  backButtonText: {
    color: '#555',
    textAlign: 'center',
    fontSize: 16,
  }
});