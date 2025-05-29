import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext'; // Điều chỉnh đường dẫn nếu cần
import { createPost, uploadPostMedia, PostCreateData, ExpoImageFile } from '../../../utils/api'; // Điều chỉnh đường dẫn nếu cần

export default function CreatePostScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  // const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null); // Nếu bạn muốn hỗ trợ video
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        const mediaLibraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (cameraStatus.status !== 'granted' || mediaLibraryStatus.status !== 'granted') {
          Alert.alert('Permissions required', 'Sorry, we need camera and media library permissions to make this work!');
        }
      }
    })();
  }, []);

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Chỉ cho phép chọn ảnh
      // mediaTypes: ImagePicker.MediaTypeOptions.All, // Nếu muốn cả ảnh và video
      allowsEditing: true,
      aspect: [4, 3], // Tỉ lệ khung hình khi edit
      quality: 0.8, // Chất lượng ảnh (0-1)
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0]);
      // setVideo(null); // Reset video nếu đang chọn ảnh
    }
  };

  // const pickVideo = async () => { // Nếu hỗ trợ video
  //   let result = await ImagePicker.launchImageLibraryAsync({
  //     mediaTypes: ImagePicker.MediaTypeOptions.Videos,
  //     allowsEditing: true,
  //     quality: 0.8, // For video, quality might apply to compression if supported
  //   });

  //   if (!result.canceled && result.assets && result.assets.length > 0) {
  //     setVideo(result.assets[0]);
  //     setImage(null); // Reset image
  //   }
  // };

  const handleCreatePost = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a post.');
      return;
    }
    if (!content.trim() && !image /*&& !video*/) {
      Alert.alert('Empty Post', 'Please write something or add an image/video.');
      return;
    }

    setIsSubmitting(true);
    setUploadingMedia(false);

    let imageUrl: string | undefined = undefined;
    // let videoUrl: string | undefined = undefined;

    try {
      if (image) {
        setUploadingMedia(true);
        const expoImageFile: ExpoImageFile = {
          uri: image.uri,
          name: image.fileName || `post-image-${Date.now()}.${image.uri.split('.').pop()}`,
          type: image.mimeType || 'image/jpeg',
        };
        const uploadResponse = await uploadPostMedia(expoImageFile);
        imageUrl = uploadResponse.url;
        setUploadingMedia(false);
      }
      // else if (video) { // Nếu hỗ trợ video
      //   setUploadingMedia(true);
      //   const expoVideoFile: ExpoImageFile = {
      //     uri: video.uri,
      //     name: video.fileName || `post-video-${Date.now()}.${video.uri.split('.').pop()}`,
      //     type: video.mimeType || 'video/mp4',
      //   };
      //   const uploadResponse = await uploadPostMedia(expoVideoFile); // Dùng chung hàm upload
      //   videoUrl = uploadResponse.url;
      //   setUploadingMedia(false);
      // }

      const postData: PostCreateData = {
        content: content.trim(),
        imageUrl: imageUrl,
        // videoUrl: videoUrl,
      };

      await createPost(postData);
      Alert.alert('Success', 'Post created successfully!');
      router.back(); // Quay lại màn hình trước đó (ví dụ: feed)
      // Hoặc router.replace('/(tabs)/posts'); để đảm bảo refresh
    } catch (error) {
      console.error('Failed to create post:', error);
      Alert.alert('Error', 'Could not create post. Please try again.');
    } finally {
      setIsSubmitting(false);
      setUploadingMedia(false);
    }
  };

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Create New Post</Text>

        <TextInput
          style={styles.input}
          placeholder="What's on your mind?"
          multiline
          value={content}
          onChangeText={setContent}
          textAlignVertical="top" // Cho Android
        />

        <View style={styles.mediaButtonsContainer}>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <Ionicons name="image-outline" size={24} color="#EB3C58" />
            <Text style={styles.mediaButtonText}>Add Photo</Text>
          </TouchableOpacity>
          {/* <TouchableOpacity style={styles.mediaButton} onPress={pickVideo}>
            <Ionicons name="videocam-outline" size={24} color="#EB3C58" />
            <Text style={styles.mediaButtonText}>Add Video</Text>
          </TouchableOpacity> */}
        </View>

        {image && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Image Preview:</Text>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} />
            <TouchableOpacity onPress={() => setImage(null)} style={styles.removeMediaButton}>
                <Ionicons name="close-circle" size={28} color="#333" />
            </TouchableOpacity>
          </View>
        )}
        {/* {video && ( // Preview cho video nếu có
          <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Video Preview:</Text>
            <Text>{video.fileName || 'Selected Video'}</Text>
            // Có thể dùng component Video để preview video
            <TouchableOpacity onPress={() => setVideo(null)} style={styles.removeMediaButton}>
                <Ionicons name="close-circle" size={28} color="#333" />
            </TouchableOpacity>
          </View>
        )} */}

        {uploadingMedia && (
            <View style={styles.uploadingIndicator}>
                <ActivityIndicator size="small" color="#EB3C58" />
                <Text style={styles.uploadingText}>Uploading media...</Text>
            </View>
        )}


        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || uploadingMedia) && styles.submitButtonDisabled]}
          onPress={handleCreatePost}
          disabled={isSubmitting || uploadingMedia}
        >
          {isSubmitting && !uploadingMedia ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Post</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isSubmitting || uploadingMedia}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50, // Đảm bảo không bị che khuất bởi bàn phím
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    minHeight: 120,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  mediaButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  mediaButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#EB3C58',
    fontWeight: '500',
  },
  previewContainer: {
    marginBottom: 20,
    alignItems: 'center',
    position: 'relative', // Để định vị nút xóa
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
  },
  previewLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    alignSelf: 'flex-start'
  },
  imagePreview: {
    width: '100%',
    height: 200, // Hoặc tính toán dựa trên aspect ratio
    resizeMode: 'contain',
    borderRadius: 8,
    marginBottom: 10,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 15,
    padding:2
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  uploadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#EB3C58',
  },
  submitButton: {
    backgroundColor: '#EB3C58',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#f9a7b5', // Màu nhạt hơn khi disable
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    borderColor: '#EB3C58',
    borderWidth: 1,
  },
  cancelButtonText: {
    color: '#EB3C58',
    fontSize: 16,
    fontWeight: 'bold',
  },
});