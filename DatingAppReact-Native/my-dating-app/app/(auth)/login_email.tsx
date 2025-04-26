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

export default function LoginWithEmail() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isNewAccount, setIsNewAccount] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const knownEmails = ['a'];

  const handleLogin = () => {
    if (isNewAccount === null) {
      // Lần đầu ấn Login -> check email
      if (knownEmails.includes(email)) {
        setIsNewAccount(false); // Tài khoản đã tồn tại
      } else {
        setIsNewAccount(true);  // Tài khoản mới
      }
      return;
    }

    if (isNewAccount) {
      if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      register({ email, password, otp });
    } else {
      login({ email, password });
    }
  };

  const handleSendOtp = () => {
    alert('OTP sent to ' + email);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login with Email</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {isNewAccount === true && (
        <>
          <View style={styles.row}>
            <TextInput
              style={styles.inputOtp}
              placeholder="Enter OTP"
              value={otp}
              onChangeText={setOtp}
            />
            <TouchableOpacity style={styles.sendOtpButton} onPress={handleSendOtp}>
              <Text style={styles.sendOtpButtonText}>Send OTP</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </>
      )}

      {isNewAccount === false && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </>
      )}

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>
          {isNewAccount === null ? 'Next' : (isNewAccount ? 'Register' : 'Login')}
        </Text>
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
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputOtp: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 54,
    marginRight: 8,
  },
  sendOtpButton: {
    backgroundColor: '#f14c64',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sendOtpButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#f14c64',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
