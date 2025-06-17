import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { authAPI } from '../services/api';
import { initSocket } from '../services/socketService';

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
      console.log('OTP request response received:', response.data);
      
      if (!response.data.success) {
        console.log('OTP request unsuccessful:', response.data.message);
        throw new Error(response.data.message || 'Failed to send OTP');
      }
      
      console.log('OTP request successful');
      setIsLoading(false);
      return { success: true };
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
      console.log('OTP verification response received:', response.data);
      
      if (!response.data.success) {
        console.log('OTP verification unsuccessful:', response.data.message);
        throw new Error(response.data.message || 'Failed to verify OTP');
      }
      
      console.log('OTP verification successful, storing token and user data');
      // Get user data and token from response
      const userData = response.data.data.astrologer;
      const authToken = response.data.data.token;
      
      // Add role field for astrologer app
      userData.role = 'astrologer';
      
      // Debug userData structure
      console.log('userData:', JSON.stringify(userData, null, 2));
      console.log('userData._id:', userData._id);
      console.log('userData.id:', userData.id);
      console.log('userData.role:', userData.role);
      
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
      const response = await axios.post('http://localhost:5000/api/v1/astrologers/update-status', {
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
