import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { changePassword } from '../../utils/api'; // Assuming this is the correct path and function name
import { useAuth } from '../context/AuthContext'; // To potentially get userId or token if needed

const ChangePasswordScreen = () => {
  const router = useRouter();
  const { user } = useAuth(); // Get authenticated user info
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setError(null);
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    if (newPassword.length < 6) { // Example validation
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setIsLoading(true);
    try {
      // Assuming changePassword API needs an object like this.
      // Adjust if your API expects different parameters or structure.
      // Also, ensure your API handles authentication (e.g., via a token sent in headers).
      // If userId is needed explicitly, you can get it from `user?.userId`.
      await changePassword({
        oldPassword: currentPassword, // Corrected field name
        newPassword,
        // confirmNewPassword is used for client-side validation only, not sent to API
      });
      Alert.alert('Thành công', 'Đổi mật khẩu thành công!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (apiError: any) {
      console.error('Failed to change password:', apiError);
      const errorMessage = apiError.response?.data?.message || apiError.message || 'Đã xảy ra lỗi khi đổi mật khẩu. Vui lòng thử lại.';
      setError(errorMessage);
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.title}>Đổi mật khẩu</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Mật khẩu hiện tại"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu mới"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder="Xác nhận mật khẩu mới"
        secureTextEntry
        value={confirmNewPassword}
        onChangeText={setConfirmNewPassword}
        placeholderTextColor="#888"
      />

      <TouchableOpacity style={styles.button} onPress={handleChangePassword} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Đổi mật khẩu</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 50, // Adjust as needed for status bar and header
  },
  backButton: {
    position: 'absolute',
    top: 50, // Adjust to align with typical header back button position
    left: 20,
    zIndex: 1,
    padding: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#eb3c58',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },
});

export default ChangePasswordScreen;
