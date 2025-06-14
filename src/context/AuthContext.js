import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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
          setUser(JSON.parse(userData));
          
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
      setIsLoading(true);
      
      // Call backend API to request OTP
      const response = await axios.post('http://localhost:5000/api/v1/auth/request-otp', {
        phoneNumber,
        role: 'astrologer',
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to send OTP');
      }
      
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.log('Error requesting OTP:', error);
      setIsLoading(false);
      return { success: false, message: error.response?.data?.message || 'Failed to send OTP' };
    }
  };
  
  // Verify OTP
  const verifyOtp = async (phoneNumber, otp) => {
    try {
      setIsLoading(true);
      
      // Call backend API to verify OTP
      const response = await axios.post('http://localhost:5000/api/v1/auth/verify-otp', {
        phoneNumber,
        otp,
        role: 'astrologer',
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to verify OTP');
      }
      
      // Get user data and token from response
      const userData = response.data.astrologer;
      const authToken = response.data.token;
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('astrologerToken', authToken);
      await AsyncStorage.setItem('astrologerData', JSON.stringify(userData));
      
      // Update state
      setUserToken(authToken);
      setUser(userData);
      
      // Set default auth header for axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      
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
