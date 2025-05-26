// app/(setup)/edit-profile.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  KeyboardAvoidingView,
  Modal, // <-- ADDED
  Dimensions, // <-- ADDED
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, Region, MapPressEvent } from 'react-native-maps'; // <-- ADDED
import * as Location from 'expo-location'; // <-- ADDED for initial user location

import {
  updateUserProfileWithFetch,
  getUserById,
  // ApiUser, // Already imported if used, but not directly in this component's state
  UserProfileModificationData,
  ExpoImageFile,
  API_BASE_URL,
} from '../../utils/api';
import { useAuth } from '../context/AuthContext';

const GENDER_OPTIONS = [
  { label: 'Nam', value: 'Man' },
  { label: 'Nữ', value: 'Woman' },
  { label: 'Khác', value: 'Other' },
];

const DEFAULT_LOCATION = { // e.g., Ho Chi Minh City
  latitude: 10.7769,
  longitude: 106.7009,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EditProfileScreen = () => {
  const router = useRouter();
  const { user: authUser, logout } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  
  // Location State
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [tempMarkerCoords, setTempMarkerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_LOCATION);
  const mapRef = useRef<MapView>(null);


  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedAvatarAsset, setSelectedAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [displayAvatarUri, setDisplayAvatarUri] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const getUserIdAndFetchData = async () => {
      let idToFetch: number | null = null;
      if (authUser?.userId) {
        idToFetch = authUser.userId;
      } else {
        const userIdStr = await AsyncStorage.getItem('userId');
        if (userIdStr) {
          idToFetch = parseInt(userIdStr, 10);
        }
      }

      if (idToFetch) {
        setCurrentUserId(idToFetch);
        fetchInitialProfileData(idToFetch);
      } else {
        Alert.alert("Lỗi", "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
        logout();
        setIsFetchingInitialData(false);
      }
    };
    getUserIdAndFetchData();
  }, [authUser, logout]);

  const fetchInitialProfileData = useCallback(async (userId: number) => {
    setIsFetchingInitialData(true);
    try {
      const userProfile = await getUserById(userId);
      if (userProfile) {
        if (userProfile.fullName) {
          const nameParts = userProfile.fullName.split(' ');
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
        } else {
          const nameParts = userProfile.username.split(' ');
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
        }

        setGender(userProfile.gender || null);
        setBio(userProfile.bio || '');
        setPhoneNumber(userProfile.phoneNumber || '');
        setAddress(userProfile.address || '');

        if (userProfile.birthdate) {
          const parsedDate = new Date(userProfile.birthdate);
          if (!isNaN(parsedDate.getTime())) setBirthdate(parsedDate);
        }
        if (userProfile.avatar) {
          setDisplayAvatarUri(`${API_BASE_URL}${userProfile.avatar.startsWith('/') ? '' : '/'}${userProfile.avatar}`);
        }

        // Set initial location
        setLatitude(userProfile.latitude || null);
        setLongitude(userProfile.longitude || null);

        if (userProfile.latitude && userProfile.longitude) {
          const initialRegion = {
            latitude: userProfile.latitude,
            longitude: userProfile.longitude,
            latitudeDelta: 0.02, // Zoom in a bit
            longitudeDelta: 0.01,
          };
          setMapRegion(initialRegion);
          setTempMarkerCoords({latitude: userProfile.latitude, longitude: userProfile.longitude });
        } else {
            // Try to get current location if no saved location
            (async () => {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  console.log('Permission to access location was denied');
                  setMapRegion(DEFAULT_LOCATION); // Use default if permission denied
                  return;
                }
                try {
                    let location = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.High});
                    const currentLocRegion = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.01,
                    };
                    setMapRegion(currentLocRegion);
                    // Do not set tempMarkerCoords here, let user pick
                } catch (e) {
                    console.error("Error getting current location for map:", e);
                    setMapRegion(DEFAULT_LOCATION); // Fallback to default
                }
            })();
        }
      }
    } catch (error: any) {
      console.error("Lỗi khi tải dữ liệu hồ sơ:", error.response?.data || error.message);
      Alert.alert("Lỗi", "Không thể tải thông tin hồ sơ. Vui lòng thử lại.");
       if (error.response?.status === 401) {
        Alert.alert('Phiên hết hạn','Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.',
          [{ text: 'OK', onPress: () => logout() }]
        );
      }
    } finally {
      setIsFetchingInitialData(false);
    }
  }, [logout]);


  const pickImage = async () => {
    // ... (same as before)
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Cần quyền truy cập", "Bạn cần cấp quyền truy cập thư viện ảnh để chọn ảnh đại diện.");
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedAvatarAsset(asset);
      setDisplayAvatarUri(asset.uri);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUserId || !firstName.trim()) {
      Alert.alert("Lỗi", !currentUserId ? "Không tìm thấy ID người dùng." : "Vui lòng nhập tên.");
      return;
    }

    setIsLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const birthdateString = birthdate ? birthdate.toISOString() : undefined;

      const updatePayload: UserProfileModificationData = {
        fullName: fullName,
        gender: gender || undefined,
        birthdate: birthdateString,
        bio: bio.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        address: address.trim() || undefined,
        latitude: latitude,     // <-- ADDED
        longitude: longitude,   // <-- ADDED
      };

      let avatarFileToUpload: ExpoImageFile | undefined = undefined;
      if (selectedAvatarAsset) {
        // ... (same avatar file prep as before)
        const fileName = selectedAvatarAsset.fileName || `avatar_${Date.now()}.${selectedAvatarAsset.uri.split('.').pop()}`;
        const fileType = selectedAvatarAsset.mimeType || `image/${selectedAvatarAsset.uri.split('.').pop()}`;
        avatarFileToUpload = {
          uri: selectedAvatarAsset.uri,
          name: fileName,
          type: fileType,
        };
      }

      await updateUserProfileWithFetch(currentUserId, updatePayload, avatarFileToUpload);

      Alert.alert("Thành công", "Đã cập nhật hồ sơ!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error("Lỗi khi cập nhật hồ sơ:", error.response?.data || error.message);
      Alert.alert("Lỗi", error.response?.data?.message || "Không thể cập nhật hồ sơ. Vui lòng thử lại.");
      if (error.response?.status === 401) {
        Alert.alert('Phiên hết hạn','Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.',
          [{ text: 'OK', onPress: () => logout() }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date: Date) => {
    setBirthdate(date);
    hideDatePicker();
  };

  // Map Modal Functions
  const openMapModal = () => {
    // If there's a saved location, set temp marker to it, and region
    if (latitude && longitude) {
      const currentSavedRegion = {
        latitude: latitude,
        longitude: longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.01,
      };
      setMapRegion(currentSavedRegion);
      setTempMarkerCoords({ latitude, longitude });
    } else {
    // If no saved location, tempMarker is null, mapRegion might be current user location or default
        setTempMarkerCoords(null);
        // mapRegion should have been set in useEffect by now
    }
    setIsMapModalVisible(true);
  };

  const handleMapPress = (e: MapPressEvent) => {
    setTempMarkerCoords(e.nativeEvent.coordinate);
  };

  const confirmLocation = () => {
    if (tempMarkerCoords) {
      setLatitude(tempMarkerCoords.latitude);
      setLongitude(tempMarkerCoords.longitude);
      setMapRegion(prev => ({...prev, latitude: tempMarkerCoords.latitude, longitude: tempMarkerCoords.longitude}));
    } else { // Allow clearing location
        setLatitude(null);
        setLongitude(null);
    }
    setIsMapModalVisible(false);
  };
  
  const clearLocation = () => {
    setTempMarkerCoords(null); // Clear marker in modal
    // Optionally, you can also call confirmLocation here if you want clearing in modal to immediately reflect
    // For now, user has to press "Xác nhận vị trí" even to clear
  };


  if (isFetchingInitialData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#eb3c58" />
        <Text style={{ textAlign: 'center', marginTop: 10, fontSize: 16, color: '#555' }}>
          Đang tải thông tin...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Chỉnh sửa Hồ sơ</Text>

        {/* ... (Avatar, Name, Gender, Birthday, Bio, Phone, Address - same as before) ... */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} disabled={isLoading}>
            <Image
              source={displayAvatarUri ? { uri: displayAvatarUri } : require('../../assets/images/dating-app.png')}
              style={styles.avatar}
              onError={() => setDisplayAvatarUri(null)}
            />
            <View style={styles.cameraIcon}>
              <Text style={{ color: '#fff', fontSize: 18 }}>📷</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Tên</Text>
        <TextInput placeholder="Tên" value={firstName} onChangeText={setFirstName} style={styles.input} editable={!isLoading} placeholderTextColor="#aaa"/>
        <Text style={styles.label}>Họ</Text>
        <TextInput placeholder="Họ (tuỳ chọn)" value={lastName} onChangeText={setLastName} style={styles.input} editable={!isLoading} placeholderTextColor="#aaa"/>
        <Text style={styles.label}>Giới tính</Text>
        <View style={styles.genderOptionsContainer}>
          {GENDER_OPTIONS.map((option) => (
            <TouchableOpacity key={option.value} style={[styles.genderOption, gender === option.value && styles.genderOptionSelected, isLoading && styles.disabledInputOpacity]} onPress={() => setGender(option.value)} disabled={isLoading}>
              <Text style={[styles.genderOptionText, gender === option.value && styles.genderOptionTextSelected]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Ngày sinh</Text>
        <TouchableOpacity style={[styles.datePickerButton, isLoading && styles.disabledInputOpacity]} onPress={showDatePicker} disabled={isLoading}>
          <Text style={styles.datePickerText}>{birthdate ? birthdate.toLocaleDateString('vi-VN') : 'Chọn ngày sinh'}</Text>
        </TouchableOpacity>
        <Text style={styles.label}>Giới thiệu bản thân</Text>
        <TextInput placeholder="Viết gì đó về bạn..." value={bio} onChangeText={setBio} style={[styles.input, styles.textArea]} multiline numberOfLines={4} editable={!isLoading} placeholderTextColor="#aaa"/>
        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput placeholder="Số điện thoại (tuỳ chọn)" value={phoneNumber} onChangeText={setPhoneNumber} style={styles.input} keyboardType="phone-pad" editable={!isLoading} placeholderTextColor="#aaa"/>
        <Text style={styles.label}>Địa chỉ</Text>
        <TextInput placeholder="Địa chỉ (tuỳ chọn)" value={address} onChangeText={setAddress} style={styles.input} editable={!isLoading} placeholderTextColor="#aaa"/>

        {/* Location Section */}
        <Text style={styles.label}>Vị trí</Text>
        <TouchableOpacity
          style={[styles.locationButton, isLoading && styles.disabledInputOpacity]}
          onPress={openMapModal}
          disabled={isLoading}
        >
          <Text style={styles.locationButtonText}>
            {latitude && longitude ? `Đã chọn: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : 'Chọn vị trí trên bản đồ'}
          </Text>
        </TouchableOpacity>


        <TouchableOpacity style={[styles.saveButton, (isLoading || !firstName.trim()) && styles.disabledButton]} onPress={handleSaveProfile} disabled={isLoading || !firstName.trim()}>
          {isLoading ? (<ActivityIndicator color="#fff" />) : (<Text style={styles.saveButtonText}>Lưu thay đổi</Text>)}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} disabled={isLoading}>
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>

        <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" date={birthdate || new Date(new Date().setFullYear(new Date().getFullYear() - 18))} onConfirm={handleConfirmDate} onCancel={hideDatePicker} maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 16))} minimumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 80))} confirmTextIOS="Chọn" cancelTextIOS="Huỷ" locale="vi-VN"/>
      </View>
    </ScrollView>

    {/* Map Modal */}
    <Modal
        animationType="slide"
        transparent={false}
        visible={isMapModalVisible}
        onRequestClose={() => setIsMapModalVisible(false)}
    >
        <View style={styles.mapModalContainer}>
            <MapView
                ref={mapRef}
                style={styles.mapView}
                region={mapRegion} // Controlled region
                onRegionChangeComplete={setMapRegion} // Update region when user pans/zooms
                onPress={handleMapPress}
                showsUserLocation={true} // Shows blue dot for user's current location
                showsMyLocationButton={true} // Android only, shows button to center on user
            >
                {tempMarkerCoords && (
                    <Marker coordinate={tempMarkerCoords} title="Vị trí đã chọn" />
                )}
            </MapView>
            <View style={styles.mapActionsContainer}>
                 <TouchableOpacity style={styles.mapActionButtonClear} onPress={clearLocation}>
                    <Text style={styles.mapActionButtonText}>Xóa vị trí</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mapActionButton} onPress={confirmLocation}>
                    <Text style={styles.mapActionButtonText}>Xác nhận vị trí</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mapActionButton, styles.mapCancelButton]} onPress={() => setIsMapModalVisible(false)}>
                    <Text style={styles.mapActionButtonText}>Hủy</Text>
                </TouchableOpacity>
            </View>
        </View>
    </Modal>

    </KeyboardAvoidingView>
  );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
  // ... (previous styles: container, scrollContainer, innerContainer, title, avatarContainer, avatar, cameraIcon, label, input, textArea, genderOptionsContainer, genderOption, genderOptionSelected, genderOptionText, genderOptionTextSelected, datePickerButton, datePickerText, saveButton, saveButtonText, cancelButton, cancelButtonText, disabledButton, disabledInputOpacity)
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },
  innerContainer: { paddingHorizontal: 24, paddingVertical: 30, backgroundColor: '#fff', alignItems: 'stretch' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: '#333' },
  avatarContainer: { position: 'relative', marginBottom: 20, alignSelf: 'center' },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#eb3c58', backgroundColor: '#e0e0e0' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#eb3c58', borderRadius: 18, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  label: { fontSize: 16, color: '#555', marginBottom: 6, fontWeight: '500', alignSelf: 'flex-start' },
  input: { width: '100%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginBottom: 18, fontSize: 16, backgroundColor: '#f9f9f9', color: '#333' },
  textArea: { height: 100, textAlignVertical: 'top' },
  genderOptionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  genderOption: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', marginHorizontal: 4, backgroundColor: '#f9f9f9' },
  genderOptionSelected: { backgroundColor: '#eb3c58', borderColor: '#eb3c58' },
  genderOptionText: { fontSize: 15, color: '#333' },
  genderOptionTextSelected: { color: '#fff', fontWeight: 'bold' },
  datePickerButton: { width: '100%', backgroundColor: '#f9f9f9', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginBottom: 18, borderWidth: 1, borderColor: '#ddd', justifyContent: 'center' },
  datePickerText: { color: '#333', fontSize: 16 },
  
  locationButton: {
    width: '100%',
    backgroundColor: '#f0f8ff', // Light blue
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#add8e6', // Lighter blue border
    alignItems: 'center',
  },
  locationButtonText: {
    color: '#007bff', // Blue text
    fontSize: 16,
  },

  saveButton: { backgroundColor: '#eb3c58', paddingVertical: 16, borderRadius: 10, width: '100%', alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#f0f0f0', paddingVertical: 14, borderRadius: 10, width: '100%', alignItems: 'center', marginTop: 12, marginBottom: 20 },
  cancelButtonText: { color: '#555', fontSize: 16, fontWeight: '500' },
  disabledButton: { backgroundColor: '#f9a0ae' },
  disabledInputOpacity: { opacity: 0.6 },
  
  mapModalContainer: {
    flex: 1,
    // justifyContent: 'flex-end', // Positions modal content at the bottom
  },
  mapView: {
    flex: 1,
    // width: screenWidth,
    // height: screenHeight * 0.7, // Adjust as needed
  },
  mapActionsContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mapActionButton: {
    backgroundColor: '#eb3c58',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
  },
  mapActionButtonClear: {
    backgroundColor: '#A9A9A9', // Dark Gray
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
  },
  mapCancelButton: {
    backgroundColor: '#ccc',
  },
  mapActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});