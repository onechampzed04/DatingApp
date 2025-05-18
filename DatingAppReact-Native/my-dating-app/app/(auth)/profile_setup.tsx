import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Modal, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

export default function ProfileDetailsScreen() {
  const [firstName, setFirstName] = useState('David');
  const [lastName, setLastName] = useState('Peterson');
  const [birthday, setBirthday] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  
  const router = useRouter(); // Initialize the router

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const saveBirthday = () => {
    const formattedDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    setBirthday(formattedDate);
    setModalVisible(false);
  };

  const generateYears = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1900; year--) {
      years.push(year);
    }
    return years;
  };

  const generateMonths = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  const generateDays = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const handleSkip = () => {
    router.push('/(auth)/habit');  // Replace with the actual screen path
  };

  const handleConfirm = () => {
    // Perform any save logic or validation if needed
    router.push('/(auth)/habit');  // Replace with the actual screen path
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Bỏ qua</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Thông tin hồ sơ</Text>

      <View style={styles.avatarContainer}>
        <Image
          source={profileImage ? { uri: profileImage } : require('../../assets/images/facebook.png')}
          style={styles.avatar}
        />
        <TouchableOpacity style={styles.cameraButton} onPress={pickImage}>
          <Text style={styles.cameraIcon}>📷</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Họ"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Tên"
        value={lastName}
        onChangeText={setLastName}
      />
      
      <TouchableOpacity style={styles.birthdayButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.birthdayText}>
          {birthday ? birthday : 'Chọn ngày sinh'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.confirmText}>Xác nhận</Text>
      </TouchableOpacity>

      {/* Modal chọn ngày sinh */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn ngày sinh</Text>
            <View style={styles.pickerContainer}>
              <ScrollView style={styles.pickerColumn}>
                {generateYears().map((year) => (
                  <TouchableOpacity key={year} onPress={() => setSelectedYear(year)}>
                    <Text style={[
                      styles.pickerItem,
                      year === selectedYear && styles.selectedItem
                    ]}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView style={styles.pickerColumn}>
                {generateMonths().map((month) => (
                  <TouchableOpacity key={month} onPress={() => setSelectedMonth(month)}>
                    <Text style={[
                      styles.pickerItem,
                      month === selectedMonth && styles.selectedItem
                    ]}>{month}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView style={styles.pickerColumn}>
                {generateDays().map((day) => (
                  <TouchableOpacity key={day} onPress={() => setSelectedDay(day)}>
                    <Text style={[
                      styles.pickerItem,
                      day === selectedDay && styles.selectedItem
                    ]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#E53950' }]} onPress={saveBirthday}>
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  skipButton: {
    alignSelf: 'flex-end',
  },
  skipText: {
    color: '#E53950',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
  },
  avatarContainer: {
    marginTop: 30,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  cameraButton: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    backgroundColor: '#E53950',
    borderRadius: 20,
    padding: 8,
  },
  cameraIcon: {
    fontSize: 20,
    color: '#fff',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginTop: 20,
  },
  birthdayButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FEEEEF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  birthdayText: {
    color: '#E53950',
    fontSize: 16,
  },
  confirmButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#E53950',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  confirmText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerColumn: {
    flex: 1,
    height: 150,
  },
  pickerItem: {
    textAlign: 'center',
    fontSize: 18,
    paddingVertical: 8,
    color: '#555',
  },
  selectedItem: {
    color: '#E53950',
    fontWeight: 'bold',
    fontSize: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#ddd',
    borderRadius: 10,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#000',
  },
});
