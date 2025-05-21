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
import * as ImagePicker from 'expo-image-picker'; // <<<< THÊM IMPORT NÀY
import { updateUserProfile, getUserById, ApiUser, UserProfileUpdateData } from '../../utils/api'; // Kiểm tra lại đường dẫn

const ProfileSetupScreen = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const [selectedAvatarUri, setSelectedAvatarUri] = useState<string | null>(null); // <<<< URI để hiển thị
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null); // <<<< Base64 để gửi đi

  const [isLoading, setIsLoading] = useState(false); // Loading chung cho submit profile
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false); // Loading riêng cho upload avatar
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null); // Để lưu avatar từ DB


  useEffect(() => {
    const fetchInitialProfileData = async () => {
      setIsFetchingInitialData(true);
      try {
        const userIdStr = await AsyncStorage.getItem('userId');
        if (!userIdStr) {
          Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
          router.replace('/login');
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
          if (userProfile.avatar) { // <<<< HIỂN THỊ AVATAR TỪ DB KHI LOAD
            // Nếu avatar từ DB là Base64, đảm bảo nó có tiền tố data URI
            if (userProfile.avatar.startsWith('data:image')) {
                setSelectedAvatarUri(userProfile.avatar);
            } else {
                // Nếu là URL, bạn có thể set trực tiếp, nhưng ví dụ này tập trung base64
                // Giả định ở đây là avatar trong DB là Base64 (có thể cần tiền tố)
                // setSelectedAvatarUri(`data:image/jpeg;base64,${userProfile.avatar}`); // Tùy thuộc định dạng lưu
                // HOẶC nếu bạn lưu base64 thuần:
                setInitialAvatarUrl(userProfile.avatar); // Để biết avatar gốc từ DB là gì
                // Bạn cần một cách để phân biệt URI local với base64 từ DB khi hiển thị
            }
          }
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu hồ sơ ban đầu:", error);
      } finally {
        setIsFetchingInitialData(false);
      }
    };

    fetchInitialProfileData();
  }, [router]);


  const pickImage = async () => {
    // Yêu cầu quyền truy cập thư viện ảnh
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Cần quyền truy cập", "Bạn cần cấp quyền truy cập thư viện ảnh để chọn ảnh đại diện.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Tỷ lệ khung hình vuông
      quality: 0.5, // Chất lượng ảnh (0-1), giảm để base64 nhỏ hơn
      base64: true, // <<<< YÊU CẦU TRẢ VỀ BASE64
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedAvatarUri(asset.uri); // URI để hiển thị trên máy
      if (asset.base64) {
        // Tạo chuỗi Base64 đầy đủ với data URI prefix
        const base64WithPrefix = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
        setAvatarBase64(base64WithPrefix);
        // Nếu bạn muốn lưu ngay khi chọn, có thể gọi hàm lưu ở đây
        // await handleSaveAvatar(base64WithPrefix); 
      }
    }
  };

  // Hàm lưu avatar (có thể gọi riêng hoặc gộp vào handleConfirmProfile)
  const handleSaveAvatar = async (base64Data: string | null) => {
    if (!currentUserId || !base64Data) {
        // Không cần alert ở đây nếu nó được gọi tự động
        return false; 
    }
    setIsUploadingAvatar(true);
    try {
        await updateUserProfile(currentUserId, { avatar: base64Data });
        // Alert.alert("Thành công", "Đã cập nhật ảnh đại diện!");
        setInitialAvatarUrl(base64Data); // Cập nhật lại initialAvatarUrl sau khi lưu thành công
        return true;
    } catch (error: any) {
        console.error("Lỗi khi cập nhật ảnh đại diện:", error.response?.data || error.message);
        Alert.alert("Lỗi", "Không thể cập nhật ảnh đại diện. Vui lòng thử lại.");
        return false;
    } finally {
        setIsUploadingAvatar(false);
    }
  };


  const handleConfirmProfile = async () => {
    // ... (phần validation firstName, birthday, currentUserId như cũ)
    if (!firstName.trim() || !birthday || !currentUserId) {
        // ... (Alerts tương ứng)
        if (!firstName.trim()) Alert.alert("Thiếu thông tin", "Vui lòng nhập tên của bạn.");
        else if (!birthday) Alert.alert("Thiếu thông tin", "Vui lòng chọn ngày sinh của bạn.");
        else if (!currentUserId) Alert.alert("Lỗi", "Không tìm thấy ID người dùng. Vui lòng thử lại.");
        return;
    }

    setIsLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const birthdateString = birthday.toISOString();

      let updatePayload: UserProfileUpdateData = {
        fullName: fullName,
        birthdate: birthdateString,
      };

      // Chỉ thêm avatar vào payload nếu nó đã được chọn và khác với avatar ban đầu từ DB
      // Hoặc nếu người dùng muốn xóa avatar (cần logic thêm)
      if (avatarBase64 && avatarBase64 !== initialAvatarUrl) {
        updatePayload.avatar = avatarBase64;
      }
      // Nếu không có avatar mới được chọn, backend sẽ không thay đổi avatar hiện tại (do Cách 2)

      await updateUserProfile(currentUserId, updatePayload);

      Alert.alert("Thành công", "Đã cập nhật hồ sơ!"); // Có thể gộp thông báo
      router.push('/(setup)/habit');
    } catch (error: any) {
      console.error("Lỗi khi cập nhật hồ sơ:", error.response?.data || error.message);
      Alert.alert("Lỗi", error.response?.data?.message || "Không thể cập nhật hồ sơ. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  // ... (showDatePicker, hideDatePicker, handleConfirmDate, handleSkip như cũ)
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
    // ... (ActivityIndicator như cũ)
    return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center'}]}>
            <ActivityIndicator size="large" color="#eb3c58" />
            <Text style={{ textAlign: 'center', marginTop: 10, fontSize: 16, color: '#555' }}>
            Đang tải thông tin...
            </Text>
        </View>
        );
  }

  // URI để hiển thị: ưu tiên ảnh mới chọn, sau đó là avatar từ DB (đã có tiền tố)
  const displayAvatarUri = selectedAvatarUri || initialAvatarUrl;


  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.innerContainer}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={isLoading || isUploadingAvatar}>
          <Text style={styles.skipText}>Bỏ qua</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Thông tin hồ sơ</Text>

        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} disabled={isUploadingAvatar}>
            {isUploadingAvatar ? (
                <View style={[styles.avatar, styles.avatarLoading]}>
                    <ActivityIndicator color="#eb3c58" size="large"/>
                </View>
            ) : (
                <Image
                // Hiển thị ảnh đã chọn (nếu có) hoặc avatar từ DB, hoặc ảnh mặc định
                source={displayAvatarUri ? { uri: displayAvatarUri } : require('../../assets/images/dating-app.png')} // <<<< THAY BẰNG ẢNH MẶC ĐỊNH CỦA BẠN
                style={styles.avatar}
                />
            )}
            <View style={styles.cameraIcon}>
              <Text style={{ color: '#fff', fontSize: 18 }}>📷</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ... (TextInput cho firstName, lastName như cũ) ... */}
        <TextInput
          placeholder="Tên"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
          editable={!isLoading && !isUploadingAvatar}
          placeholderTextColor="#aaa"
        />

        <TextInput
          placeholder="Họ (tuỳ chọn)"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
          editable={!isLoading && !isUploadingAvatar}
          placeholderTextColor="#aaa"
        />

        {/* ... (TouchableOpacity cho birthday như cũ) ... */}
         <TouchableOpacity
          style={[styles.birthdayButton, (isLoading || isUploadingAvatar) && styles.disabledInput]}
          onPress={showDatePicker}
          disabled={isLoading || isUploadingAvatar}
        >
          <Text style={styles.birthdayText}>
            {birthday
              ? birthday.toLocaleDateString('vi-VN') 
              : 'Chọn ngày sinh'}
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={[styles.confirmButton, (isLoading || isUploadingAvatar) && styles.disabledButton]}
          onPress={handleConfirmProfile}
          disabled={isLoading || isUploadingAvatar || !firstName.trim() || !birthday}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>Xác nhận và Tiếp tục</Text>
          )}
        </TouchableOpacity>

        <DateTimePickerModal
          // ... (props như cũ) ...
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

// StyleSheet (giữ nguyên styles cũ, thêm style cho avatar loading)
const styles = StyleSheet.create({
  // ... (tất cả styles cũ của bạn)
  container: { // Cần có backgroundColor cho View gốc của ActivityIndicator loading
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
    backgroundColor: '#e0e0e0', // Màu nền cho avatar khi chưa có ảnh
  },
  avatarLoading: { // Style khi avatar đang tải
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