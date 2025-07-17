import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Alert } from 'react-native';
import { authAPI } from '../services/api';
import { initSocket } from '../services/socketService';
// import LogRocket from '@logrocket/react-native'; // Temporarily disabled due to build issues

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [user, setUser] = useState(null);
  
  // Initialize auth state from AsyncStorage
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem('astrologerToken');
        const userData = await AsyncStorage.getItem('astrologerData');
        
        if (token && userData) {
          setUserToken(token);
          const parsedUserData = JSON.parse(userData);
          // Ensure role field is present for astrologer app
          parsedUserData.role = 'astrologer';
          setUser(parsedUserData);
          
          // Identify user with LogRocket
          try {
            if (false) { // Temporarily disabled
              // LogRocket.identify(parsedUserData._id || parsedUserData.id, {
              //   name: parsedUserData.name,
              //   email: parsedUserData.email,
              //   role: 'astrologer'
              // });
              console.log('LogRocket identify disabled temporarily:', parsedUserData._id || parsedUserData.id);
            }
          } catch (error) {
            console.warn('LogRocket identify failed:', error);
          }
          
          // Set default auth header for axios
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      } catch (error) {
        console.log('Error restoring auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    bootstrapAsync();
  }, []);
  
  // Request OTP for login
  const requestOtp = async (phoneNumber) => {
    try {
      console.log('Starting OTP request for phone number:', phoneNumber);
      setIsLoading(true);
      
      // Call backend API to request OTP using the centralized API service
      console.log('Calling authAPI.requestOtp with phone number:', phoneNumber);
      const response = await authAPI.requestOtp(phoneNumber);
      console.log('OTP request response received:', response);
      
      // Check if response has expected fields and SMS was sent successfully
      if (!response.success || !response.data || response.data.smsStatus !== 'sent') {
        console.log('OTP request unsuccessful - invalid response structure or SMS failed');
        throw new Error('Failed to send OTP');
      }
      
      // OTP sent via SMS - no longer displayed in app for security
      console.log('OTP request successful');
      setIsLoading(false);
      return { success: true, message: 'OTP sent successfully to your mobile number' };
    } catch (error) {
      console.log('Error requesting OTP:', error);
      console.log('Error details:', error.message);
      console.log('Response data:', error.response?.data);
      console.log('Response status:', error.response?.status);
      setIsLoading(false);
      
      // Extract specific error message from the response
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to send OTP';
      return { success: false, message: errorMessage };
    }
  };
  
  // Verify OTP
  const verifyOtp = async (phoneNumber, otp) => {
    try {
      console.log('Starting OTP verification for phone number:', phoneNumber, 'with OTP code:', otp);
      setIsLoading(true);
      
      // Call backend API to verify OTP using the centralized API service
      console.log('Calling authAPI.verifyOtp with phone number:', phoneNumber, 'and OTP code:', otp);
      const response = await authAPI.verifyOtp(phoneNumber, otp);
      console.log('OTP verification response received:', response);
      
      // Check if response has expected fields (success, data with token and astrologer)
      if (!response.success || !response.data || !response.data.token || !response.data.astrologer) {
        console.log('OTP verification unsuccessful - invalid response structure');
        throw new Error('Failed to verify OTP');
      }
      
      console.log('OTP verification successful, storing token and user data');
      // Get user data and token from response
      const userData = response.data.astrologer;
      const authToken = response.data.token;
      
      // Add role field for astrologer app
      userData.role = 'astrologer';
      
      // Debug userData structure
      console.log('userData:', JSON.stringify(userData, null, 2));
      console.log('userData._id:', userData._id);
      console.log('userData.id:', userData.id);
      console.log('userData.role:', userData.role);
      
      // Identify user with LogRocket
      try {
        if (false) { // Temporarily disabled
          // LogRocket.identify(userData._id || userData.id, {
          //   name: userData.name,
          //   email: userData.email,
          //   role: userData.role
          // });
          console.log('LogRocket identify disabled temporarily:', userData._id || userData.id);
        }
      } catch (error) {
        console.warn('LogRocket identify failed:', error);
      }
      
      // Store auth data in AsyncStorage
      await AsyncStorage.setItem('astrologerToken', authToken);
      await AsyncStorage.setItem('astrologerId', userData._id);
      await AsyncStorage.setItem('astrologerData', JSON.stringify(userData));
      
      // Update auth state
      setUserToken(authToken);
      setUser(userData);
      
      // Set default auth header for axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      
      // Socket connection will be handled by SocketManager component
      console.log('Login successful - socket connection will be managed by SocketManager');
      
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.log('Error verifying OTP:', error);
      setIsLoading(false);
      return { success: false, message: error.response?.data?.message || 'Failed to verify OTP' };
    }
  };
  
  // Update availability status
  const updateAvailability = async (isAvailable) => {
    try {
      setIsLoading(true);
      
      // Call backend API to update availability status
      const response = await axios.post('https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1/astrologers/update-status', {
        isAvailable
      }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update availability');
      }
      
      // Update local user data
      const updatedUser = { ...user, online: isAvailable };
      await AsyncStorage.setItem('astrologerData', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.log('Error updating status:', error);
      setIsLoading(false);
      return { success: false, message: error.response?.data?.message || 'Failed to update status' };
    }
  };
  
  // Logout
  const logout = async () => {
    try {
      setIsLoading(true);
      
      // In a real app, you might want to notify the backend
      // await axios.post('http://your-backend-url.com/api/v1/auth/logout');
      
      // Clear LogRocket session
      try {
        if (false) { // Temporarily disabled
          // console.log('LogRocket session URL before logout:', LogRocket.sessionURL);
        }
      } catch (error) {
        console.warn('LogRocket session access failed:', error);
      }
      
      // Clear auth state
      await AsyncStorage.removeItem('astrologerToken');
      await AsyncStorage.removeItem('astrologerData');
      
      // Clear axios default header
      delete axios.defaults.headers.common['Authorization'];
      
      // Update state
      setUserToken(null);
      setUser(null);
      
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.log('Error logging out:', error);
      setIsLoading(false);
      return { success: false, message: 'Failed to logout' };
    }
  };
  
  return (
    <AuthContext.Provider
      value={{
        isLoading,
        userToken,
        user,
        requestOtp,
        verifyOtp,
        updateAvailability,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
