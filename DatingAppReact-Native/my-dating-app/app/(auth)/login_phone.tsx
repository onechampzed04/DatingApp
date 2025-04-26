import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export default function LoginWithPhone() {
  const { login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const handleSendOTP = () => {
    // Giả sử gửi OTP ở đây
    console.log('Sending OTP to', phone);
  };

  const handleLogin = () => {
    login({ phone, otp });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login with Phone Number</Text>

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <TouchableOpacity style={styles.sendOtpButton} onPress={handleSendOTP}>
        <Text style={styles.sendOtpText}>Send OTP</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Enter OTP"
        keyboardType="numeric"
        value={otp}
        onChangeText={setOtp}
      />

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
    color: '#f14c64',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  sendOtpButton: {
    backgroundColor: '#fff',
    borderColor: '#f14c64',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  sendOtpText: {
    color: '#f14c64',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#f14c64',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
