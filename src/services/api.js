import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API URL Configuration - Comment/Uncomment as needed
// Local Development (commented out for production)
// const API_URL = 'http://192.168.29.107:5000/api/v1';

// Production - New backend URL
const API_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1';
// Old production URL: const API_URL = 'http://3.110.171.85/api/v1';

// Create axios instance
const API = axios.create({
  baseURL: API_URL,
});

// Add authorization header to every request if token exists
API.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('astrologerToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  requestOtp: (phoneNumber) => API.post('/auth/request-otp', { mobile: phoneNumber, role: 'astrologer' }),
  verifyOtp: (phoneNumber, otp) => API.post('/auth/verify-otp', { mobile: phoneNumber, otp, role: 'astrologer' }),
  updateProfile: (profileData) => API.put('/astrologers/profile', profileData),
  registerDeviceToken: (token) => API.post('/astrologers/register-device-token', { token }),
};

// Availability API
export const availabilityAPI = {
  updateStatus: (isAvailable) => API.post('/astrologers/update-status', { isAvailable }),
  updateSchedule: (schedule) => API.post('/astrologers/update-schedule', { schedule }),
  getSchedule: () => API.get('/astrologers/schedule'),
};

// Bookings API
export const bookingsAPI = {
  getAll: (status) => API.get('/bookings', { params: { status, role: 'astrologer' } }),
  getById: (id) => API.get(`/bookings/${id}`),
  accept: (id) => API.put(`/bookings/${id}/accept`),
  reject: (id) => API.put(`/bookings/${id}/reject`),
};

// Sessions API
export const sessionsAPI = {
  start: (bookingId, type) => API.post('/sessions/start', { bookingId, type }),
  end: (sessionId) => API.post('/sessions/end', { sessionId }),
  getActive: () => API.get('/sessions/active'),
};

// Earnings API
export const earningsAPI = {
  getSummary: () => API.get('/astrologers/earnings'),
  getTransactions: () => API.get('/astrologers/transactions'),
};

// Wallet API
export const walletAPI = {
  getBalance: () => API.get('/wallet/balance'),
};

export default API;
