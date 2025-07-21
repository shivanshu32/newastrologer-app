import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const OtpVerificationScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params || {};
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const { verifyOtp, requestOtp, isLoading } = useAuth();
  
  const inputRefs = useRef([]);

  useEffect(() => {
    // Start countdown timer
    if (timeLeft > 0) {
      const timerId = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  // Enhanced OTP change handler with auto-fill support (permission-free)
  const handleOtpChange = (text, index) => {
    // Check if the input contains multiple digits (auto-fill scenario)
    if (text.length > 1) {
      // Extract only digits from the text
      const digits = text.replace(/\D/g, '');
      
      if (digits.length >= 4) {
        // Auto-fill all 4 digits
        const newOtp = digits.slice(0, 4).split('');
        setOtp(newOtp);
        
        // Focus the last input after auto-fill
        setTimeout(() => {
          inputRefs.current[3]?.focus();
        }, 100);
        
        console.log('🔢 Auto-filled OTP from SMS:', newOtp.join(''));
        return;
      }
    }
    
    // Handle single digit input (manual typing)
    const newOtp = [...otp];
    newOtp[index] = text.replace(/\D/g, ''); // Only allow digits
    setOtp(newOtp);

    // Auto-focus next input if current input is filled
    if (text && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace key
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter a valid 4-digit OTP.');
      return;
    }
    
    const result = await verifyOtp(phoneNumber, otpString);
    
    if (!result.success) {
      Alert.alert('Error', result.message || 'Failed to verify OTP. Please try again.');
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    const result = await requestOtp(phoneNumber);
    
    if (result.success) {
      setTimeLeft(30);
      setCanResend(false);
      Alert.alert('OTP Sent', 'A new OTP has been sent to your phone number.');
    } else {
      Alert.alert('Error', result.message || 'Failed to resend OTP. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.content}>
          <Text style={styles.title}>OTP Verification</Text>
          <Text style={styles.subtitle}>
            Enter the 4-digit code sent to {phoneNumber}
          </Text>
          
          <View style={styles.otpContainer}>
            {[0, 1, 2, 3].map((index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.otpInput}
                value={otp[index]}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={index === 0 ? 4 : 1} // Allow first input to accept full OTP
                autoFocus={index === 0}
                // Android SMS auto-read properties
                textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                importantForAutofill="yes"
                // Additional properties for better auto-fill support
                selectTextOnFocus={true}
                blurOnSubmit={false}
                returnKeyType="next"
                placeholderTextColor="#9CA3AF"
              />
            ))}
          </View>
          
          <TouchableOpacity
            style={[styles.button, otp.join('').length !== 4 && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={otp.join('').length !== 4 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOtp} disabled={isLoading}>
                <Text style={styles.resendButton}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.timer}>Resend in {timeLeft}s</Text>
            )}
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  backButton: {
    marginTop: 20,
    marginBottom: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 30,
  },
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#F97316',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    color: '#666',
  },
  resendButton: {
    color: '#F97316',
    fontWeight: 'bold',
  },
  timer: {
    color: '#666',
  },
});

export default OtpVerificationScreen;
