import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = () => {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Đăng xuất",
      "Bạn có chắc chắn muốn đăng xuất?",
      [
        {
          text: "Hủy",
          style: "cancel"
        },
        {
          text: "Đăng xuất",
          onPress: () => {
            logout();
            router.replace('/(auth)/login'); // Navigate to login screen after logout
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleChangePassword = () => {
    // Navigate to the change password screen
    router.push('/(auth)/change-password');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
        <Ionicons name="key-outline" size={24} color="#333" style={styles.icon} />
        <Text style={styles.menuItemText}>Đổi mật khẩu</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#eb3c58" style={styles.icon} />
        <Text style={[styles.menuItemText, styles.logoutText]}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 20,
  },
  menuItem: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  icon: {
    marginRight: 15,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  logoutText: {
    color: '#eb3c58',
  },
});

export default SettingsScreen;
