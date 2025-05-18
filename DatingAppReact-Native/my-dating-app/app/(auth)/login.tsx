import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

export default function AuthOptions() {
  const router = useRouter();

  const handleEmailSignup = () => {
    router.push('/(auth)/login_email');
  };

  const handlePhoneSignup = () => {
    // TODO: Triển khai đăng nhập bằng số điện thoại sau
    router.push('/(auth)/login_phone');
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/dating-app.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Sign up to continue</Text>

      <TouchableOpacity style={styles.emailButton} onPress={handleEmailSignup}>
        <Text style={styles.emailButtonText}>Continue with email</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.phoneButton} onPress={handlePhoneSignup}>
        <Text style={styles.phoneButtonText}>Use phone number</Text>
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.orText}>or sign up with</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialContainer}>
        <TouchableOpacity style={styles.socialButton}>
          <Image
            source={require('../../assets/images/facebook.png')}
            style={styles.socialIcon}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButton}>
          <Image
            source={require('../../assets/images/google.png')}
            style={styles.socialIcon}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialButton}>
          <Image
            source={require('../../assets/images/apple.png')}
            style={styles.socialIcon}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.footerLinks}>
        <Text style={styles.link}>Terms of use</Text>
        <Text style={styles.link}>Privacy Policy</Text>
      </View>
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
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
  },
  emailButton: {
    backgroundColor: '#f14c64',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  emailButtonText: {
    color: 'white',
    fontSize: 16,
  },
  phoneButton: {
    borderColor: '#f14c64',
    borderWidth: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  phoneButtonText: {
    color: '#f14c64',
    fontSize: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ccc',
  },
  orText: {
    marginHorizontal: 8,
    color: '#888',
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  socialButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    elevation: 3,
  },
  socialIcon: {
    width: 30,
    height: 30,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  link: {
    color: '#f14c64',
  },
});