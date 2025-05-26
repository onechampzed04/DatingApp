// app/(setup)/profile.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
// Quan trọng: Import thêm ExpoImageFile và API_BASE_URL
import {
  updateUserProfileWithFetch,
  getUserById,
  ApiUser,
  UserProfileModificationData, // Đổi tên từ UserProfileUpdateData cho nhất quán
  ExpoImageFile,
  API_BASE_URL, // Import API_BASE_URL
} from '../../utils/api'; // Kiểm tra lại đường dẫn

const ProfileSetupScreen = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  // State mới để lưu trữ ImagePickerAsset
  const [selectedAvatarAsset, setSelectedAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  // URI để hiển thị ảnh (có thể là local URI hoặc URL từ server)
  const [displayAvatarUri, setDisplayAvatarUri] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const fetchInitialProfileData = async () => {
      setIsFetchingInitialData(true);
      try {
        const userIdStr = await AsyncStorage.getItem('userId');
        if (!userIdStr) {
          Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
          router.replace('/login'); // Hoặc màn hình đăng nhập của bạn
          return;
        }
        const id = parseInt(userIdStr, 10);
        setCurrentUserId(id);

        const userProfile = await getUserById(id);
        if (userProfile) {
          if (userProfile.fullName) {
            const nameParts = userProfile.fullName.split(' ');
            setFirstName(nameParts[0] || '');
            setLastName(nameParts.slice(1).join(' ') || '');
          }
          if (userProfile.birthdate) {
            const parsedDate = new Date(userProfile.birthdate);
            if (!isNaN(parsedDate.getTime())) {
              setBirthday(parsedDate);
            } else {
              console.warn("Ngày sinh không hợp lệ từ backend:", userProfile.birthdate);
            }
          }
          if (userProfile.avatar) {
            // userProfile.avatar giờ là URL tương đối, ví dụ: /images/avatars/abc.jpg
            // Nối với API_BASE_URL để có URL đầy đủ
            setDisplayAvatarUri(`${API_BASE_URL}${userProfile.avatar}`);
          }
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu hồ sơ ban đầu:", error);
        Alert.alert("Lỗi", "Không thể tải thông tin hồ sơ. Vui lòng thử lại.");
      } finally {
        setIsFetchingInitialData(false);
      }
    };

    fetchInitialProfileData();
  }, [router]);


  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Cần quyền truy cập", "Bạn cần cấp quyền truy cập thư viện ảnh để chọn ảnh đại diện.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, // Giảm chất lượng một chút để file nhỏ hơn, không cần base64
      // base64: true, // <<<< BỎ DÒNG NÀY
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedAvatarAsset(asset); // Lưu toàn bộ asset
      setDisplayAvatarUri(asset.uri); // Hiển thị URI local ngay lập tức
    }
  };

  // Bỏ hàm handleSaveAvatar vì việc lưu avatar sẽ gộp vào handleConfirmProfile

  const handleConfirmProfile = async () => {
    if (!firstName.trim() || !birthday || !currentUserId) {
      if (!firstName.trim()) Alert.alert("Thiếu thông tin", "Vui lòng nhập tên của bạn.");
      else if (!birthday) Alert.alert("Thiếu thông tin", "Vui lòng chọn ngày sinh của bạn.");
      else if (!currentUserId) Alert.alert("Lỗi", "Không tìm thấy ID người dùng. Vui lòng thử lại.");
      return;
    }

    setIsLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const birthdateString = birthday.toISOString(); // Backend mong đợi ISO string

      const updatePayload: UserProfileModificationData = { // Sử dụng tên nhất quán
        fullName: fullName,
        birthdate: birthdateString,
        // Các trường khác nếu có: gender, bio, phoneNumber, address, profileVisibility
        // Không có trường avatar ở đây
      };

      let avatarFileToUpload: ExpoImageFile | undefined = undefined;
      if (selectedAvatarAsset) {
        // Tạo tên file và type nếu ImagePicker không cung cấp đầy đủ
        const fileName = selectedAvatarAsset.fileName || `avatar_${Date.now()}.${selectedAvatarAsset.uri.split('.').pop()}`;
        const fileType = selectedAvatarAsset.mimeType || `image/${selectedAvatarAsset.uri.split('.').pop()}`;

        avatarFileToUpload = {
          uri: selectedAvatarAsset.uri,
          name: fileName,
          type: fileType,
        };
      }

      // Gọi API updateUserProfile với payload và file avatar (nếu có)
      await updateUserProfileWithFetch(currentUserId, updatePayload, avatarFileToUpload); // << THAY BẰNG DÒNG NÀY

      Alert.alert("Thành công", "Đã cập nhật hồ sơ!");
      router.push('/(setup)/habit'); // Hoặc màn hình tiếp theo
    } catch (error: any) {
      console.error("Lỗi khi cập nhật hồ sơ:", error.response?.data || error.message);
      Alert.alert("Lỗi", error.response?.data?.message || "Không thể cập nhật hồ sơ. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date: Date) => {
    setBirthday(date);
    hideDatePicker();
  };
  const handleSkip = () => {
    router.push('/(setup)/habit');
  };

  if (isFetchingInitialData) {
    return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center'}]}>
            <ActivityIndicator size="large" color="#eb3c58" />
            <Text style={{ textAlign: 'center', marginTop: 10, fontSize: 16, color: '#555' }}>
            Đang tải thông tin...
            </Text>
        </View>
        );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.innerContainer}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={isLoading}>
          <Text style={styles.skipText}>Bỏ qua</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Thông tin hồ sơ</Text>

        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} disabled={isLoading}>
            {isLoading && selectedAvatarAsset ? ( // Hiển thị loading indicator nhỏ trên ảnh nếu đang upload
                <View style={[styles.avatar, styles.avatarLoading]}>
                    <ActivityIndicator color="#eb3c58" size="small"/>
                </View>
            ) : (
                <Image
                source={displayAvatarUri ? { uri: displayAvatarUri } : require('../../assets/images/dating-app.png')} // Ảnh mặc định của bạn
                style={styles.avatar}
                onError={(e) => { // Xử lý lỗi nếu URL ảnh không hợp lệ
                    console.warn("Error loading avatar image:", e.nativeEvent.error);
                    setDisplayAvatarUri(null); // Reset để hiển thị ảnh mặc định
                }}
                />
            )}
            <View style={styles.cameraIcon}>
              <Text style={{ color: '#fff', fontSize: 18 }}>📷</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TextInput
          placeholder="Tên"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
          editable={!isLoading}
          placeholderTextColor="#aaa"
        />

        <TextInput
          placeholder="Họ (tuỳ chọn)"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
          editable={!isLoading}
          placeholderTextColor="#aaa"
        />

         <TouchableOpacity
          style={[styles.birthdayButton, isLoading && styles.disabledInput]}
          onPress={showDatePicker}
          disabled={isLoading}
        >
          <Text style={styles.birthdayText}>
            {birthday
              ? birthday.toLocaleDateString('vi-VN')
              : 'Chọn ngày sinh'}
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={[styles.confirmButton, (isLoading || !firstName.trim() || !birthday) && styles.disabledButton]}
          onPress={handleConfirmProfile}
          disabled={isLoading || !firstName.trim() || !birthday}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>Xác nhận và Tiếp tục</Text>
          )}
        </TouchableOpacity>

        <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            date={birthday || new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
            onConfirm={handleConfirmDate}
            onCancel={hideDatePicker}
            maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 16))}
            minimumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 80))}
            confirmTextIOS="Chọn"
            cancelTextIOS="Huỷ"
            locale="vi-VN"
        />
      </View>
    </ScrollView>
  );
};

export default ProfileSetupScreen;

const styles = StyleSheet.create({
  // ... (giữ nguyên styles của bạn)
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#333',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#eb3c58',
    backgroundColor: '#e0e0e0',
  },
  avatarLoading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#eb3c58',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  input: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  birthdayButton: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  birthdayText: {
    color: '#333',
    fontSize: 16,
    textAlign: 'left',
  },
  confirmButton: {
    backgroundColor: '#eb3c58',
    paddingVertical: 16,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#f9a0ae',
  },
  disabledInput: {
    backgroundColor: '#e9e9e9',
    opacity: 0.7,
  },
  confirmText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    padding: 8,
  },
  skipText: {
    color: '#eb3c58',
    fontSize: 16,
    fontWeight: '500',
  },
});