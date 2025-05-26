// app/(auth)/(setup)/gender.tsx (Hoặc đường dẫn tương tự của bạn)

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateUserProfileWithFetch  } from '../../utils/api'; // <<<< ĐIỀU CHỈNH ĐƯỜNG DẪN NÀY

const GenderScreen = () => {
  const [selectedGender, setSelectedGender] = useState<string>('Man'); // Giá trị mặc định
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleContinue = async () => {
    if (!selectedGender) {
      Alert.alert("Chưa chọn", "Vui lòng chọn giới tính của bạn.");
      return;
    }

    setIsLoading(true);
    try {
      const userIdStr = await AsyncStorage.getItem('userId');
      if (!userIdStr) {
        Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
        router.replace('/login'); // Hoặc màn hình đăng nhập của bạn
        setIsLoading(false);
        return;
      }
      const userId = parseInt(userIdStr, 10);

      // Gọi API để cập nhật giới tính
      // Backend của bạn mong đợi một đối tượng User đầy đủ cho PutUser,
      // updateUserProfile trong api.ts sẽ fetch user hiện tại rồi merge.
      await updateUserProfileWithFetch(userId, { gender: selectedGender }); // << THAY BẰNG DÒNG NÀY

      // Alert.alert("Thành công", "Đã cập nhật giới tính!"); // Có thể bỏ qua nếu chuyển trang ngay
      router.push('/(setup)/profile'); // Chuyển đến màn hình profile setup
    } catch (error: any) {
      console.error("Lỗi khi cập nhật giới tính:", error.response?.data || error.message);
      Alert.alert("Lỗi", error.response?.data?.message || "Không thể cập nhật giới tính. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Điều hướng đến màn hình tiếp theo mà không lưu giới tính
    router.push('/(setup)/profile');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={isLoading}>
        <Text style={styles.skipText}>Bỏ qua</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Tôi là</Text>

      {['Woman', 'Man', 'Other'].map((gender) => ( // Bạn có thể thêm các tùy chọn khác
        <TouchableOpacity
          key={gender}
          style={[
            styles.option,
            selectedGender === gender && styles.selectedOption,
          ]}
          onPress={() => setSelectedGender(gender)}
          disabled={isLoading}
        >
          <Text
            style={[
              styles.optionText,
              selectedGender === gender && styles.selectedText,
            ]}
          >
            {gender === 'Woman' ? 'Nữ' : gender === 'Man' ? 'Nam' : 'Khác'}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.continueButton, isLoading && styles.disabledButton]}
        onPress={handleContinue}
        disabled={isLoading || !selectedGender}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.continueText}>Tiếp tục</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default GenderScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  option: {
    paddingVertical: 18, // Tăng padding
    paddingHorizontal: 16,
    borderRadius: 12, // Bo góc mềm hơn
    backgroundColor: '#f0f0f0', // Màu nền sáng hơn một chút
    marginBottom: 16, // Khoảng cách lớn hơn
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#eb3c58',
    borderColor: '#eb3c58',
  },
  optionText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  selectedText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  continueButton: {
    marginTop: 32,
    backgroundColor: '#eb3c58',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#f9a0ae', // Màu nhạt hơn khi bị disable
  },
  continueText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipBtn: {
    position: 'absolute',
    top: 60, // Đẩy xuống một chút
    right: 24,
    padding: 8, // Thêm padding cho dễ nhấn
  },
  skipText: {
    color: '#eb3c58',
    fontSize: 16,
    fontWeight: '500',
  },
});