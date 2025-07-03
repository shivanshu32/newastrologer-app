import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { initializeAckHandling } from '../services/socketService';

// Socket server URL - extract base URL from API_URL in api.js
// Local Development (commented out for production)
//const SOCKET_SERVER_URL = 'http://192.168.29.107:5000';

// Production - New backend URL
const SOCKET_SERVER_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app';
// Old production URL: const SOCKET_SERVER_URL = 'http://3.110.171.85';

// Create context
const SocketContext = createContext(null);

// Socket configuration constants
const PING_INTERVAL = 20000; // 20 seconds
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

export const SocketProvider = ({ children }) => {
  const { userToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const appState = useRef(AppState.currentState);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef(null);
  const pingInterval = useRef(null);
  
  // Periodic socket status monitoring
  const startSocketMonitoring = (socket) => {
    const monitorInterval = setInterval(() => {
      console.log('🔍 [SocketContext] Socket Status Check:');
      console.log('🔍 [SocketContext] Socket ID:', socket?.id);
      console.log('🔍 [SocketContext] Connected:', socket?.connected);
      console.log('🔍 [SocketContext] Transport:', socket?.io?.engine?.transport?.name);
      console.log('🔍 [SocketContext] Ready State:', socket?.io?.engine?.readyState);
      console.log('🔍 [SocketContext] Timestamp:', new Date().toISOString());
    }, 30000); // Every 30 seconds
    
    return monitorInterval;
  };
  
  // Initialize or reinitialize socket
  const initializeSocket = async () => {
    // Don't initialize if already connecting or no token available
    if (isConnecting || !userToken) {
      console.log('⚠️ [SocketContext] Skipping socket init - connecting:', isConnecting, 'token:', !!userToken);
      return;
    }
    
    try {
      console.log('🚀 [SocketContext] Initializing socket connection...');
      setIsConnecting(true);
      
      // Get authentication data
      const token = await AsyncStorage.getItem('astrologerToken');
      let astrologerId = await AsyncStorage.getItem('astrologerId');
      
      // If astrologerId is not found directly, try getting it from astrologerData
      if (!astrologerId) {
        const astrologerData = await AsyncStorage.getItem('astrologerData');
        if (astrologerData) {
          const parsedAstrologerData = JSON.parse(astrologerData);
          astrologerId = parsedAstrologerData._id || parsedAstrologerData.id;
          console.log('SocketContext: Extracted astrologerId from astrologerData:', astrologerId);
        }
      }
      
      console.log('SocketContext: Authentication data - token exists:', !!token, 'astrologerId:', astrologerId);
      
      if (!token || !astrologerId) {
        console.log('SocketContext: No user token, cleaning up socket if any');
        setIsConnecting(false);
        return;
      }
      
      // Clean up existing socket if any
      if (socket) {
        cleanupSocket();
      }
      
      // Create new socket connection
      const newSocket = io(SOCKET_SERVER_URL, {
        auth: {
          token,
          id: astrologerId,
          role: 'astrologer'
        },
        path: '/ws',
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling']
      });
      
      // Socket connection event handlers
      newSocket.on('connect', () => {
        console.log(' [SocketContext] Socket connected successfully');
        console.log(' [SocketContext] Socket ID:', newSocket.id);
        console.log(' [SocketContext] Socket transport:', newSocket.io?.engine?.transport?.name);
        console.log(' [SocketContext] Socket authenticated:', newSocket.auth);
        console.log(' [SocketContext] Connection timestamp:', new Date().toISOString());
        
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttempts.current = 0;
        
        // Clear any existing reconnect timer
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
        
        // Start ping interval
        startPingInterval(newSocket);
        
        // Start socket monitoring
        const monitorInterval = startSocketMonitoring(newSocket);
        
        // Store monitor interval for cleanup
        newSocket._monitorInterval = monitorInterval;
        
        // Log socket readiness for booking requests
        console.log('✅ [SocketContext] Socket ready to receive booking requests');
        
        // Test socket event reception
        newSocket.on('test_event', (data) => {
          console.log('🧪 [SocketContext] Test event received:', data);
        });
        
        // Monitor all incoming events for debugging
        const originalOn = newSocket.on;
        newSocket.on = function(event, handler) {
          if (event === 'booking_request') {
            console.log('👂 [SocketContext] Booking request listener attached');
          }
          return originalOn.call(this, event, handler);
        };
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnecting(false);
        
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect();
        }
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log(' [SocketContext] Socket disconnected:', reason);
        console.log(' [SocketContext] Previous Socket ID:', newSocket.id);
        console.log(' [SocketContext] Disconnect timestamp:', new Date().toISOString());
        
        setIsConnected(false);
        
        // Stop ping interval
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
          pingInterval.current = null;
        }
        
        // Stop socket monitoring
        if (newSocket._monitorInterval) {
          clearInterval(newSocket._monitorInterval);
          newSocket._monitorInterval = null;
        }
        
        // Only attempt reconnection if not manually disconnected
        if (reason !== 'io client disconnect' && userToken) {
          console.log(' [SocketContext] Scheduling reconnection...');
          scheduleReconnect();
        }
      });
      
      newSocket.on('error', (error) => {
        console.error('SocketContext: Socket error:', error);
      });
      
      // Set the socket in state
      setSocket(newSocket);
      
    } catch (error) {
      console.error('SocketContext: Error initializing socket:', error);
      setIsConnecting(false);
      
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        scheduleReconnect();
      }
    }
  };
  
  // Start ping interval to keep connection alive
  const startPingInterval = (socketInstance) => {
    // Clear existing interval if any
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
    }
    
    // Set up new interval
    pingInterval.current = setInterval(() => {
      if (socketInstance && socketInstance.connected) {
        console.log('SocketContext: Sending ping to keep connection alive');
        socketInstance.emit('ping');
      } else {
        console.log('SocketContext: Socket not connected, cannot send ping');
      }
    }, PING_INTERVAL);
  };
  
  // Schedule reconnection attempt
  const scheduleReconnect = () => {
    // Clear any existing reconnect timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    
    reconnectAttempts.current += 1;
    
    // Calculate exponential backoff delay (with a maximum)
    const delay = Math.min(RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts.current - 1), 30000);
    
    console.log(`SocketContext: Scheduling reconnect attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    
    // Schedule reconnect
    reconnectTimer.current = setTimeout(() => {
      console.log(`SocketContext: Attempting reconnect #${reconnectAttempts.current}...`);
      initializeSocket();
    }, delay);
  };
  
  // Clean up socket and related resources
  const cleanupSocket = () => {
    if (socket) {
      // Clear intervals
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }
      
      // Remove all listeners to prevent memory leaks
      socket.removeAllListeners();
      socket.disconnect();
      
      // Reset state
      setSocket(null);
      setIsConnected(false);
    }
  };
  
  // Initialize socket when auth token is available
  useEffect(() => {
    if (userToken) {
      console.log('SocketContext: User authenticated, initializing socket');
      initializeSocket();
    } else {
      console.log('SocketContext: No user token, cleaning up socket if any');
      cleanupSocket();
    }
    
    // Clean up on unmount
    return () => {
      console.log('SocketContext: Component unmounting, cleaning up');
      cleanupSocket();
      
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [userToken]);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log('SocketContext: App state changed from', appState.current, 'to', nextAppState);
      
      // App has come to the foreground
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active' &&
        userToken
      ) {
        console.log('SocketContext: App has come to foreground, checking socket connection');
        
        if (!socket || !isConnected) {
          console.log('SocketContext: Socket not connected, reinitializing');
          initializeSocket();
        }
      }
      
      appState.current = nextAppState;
    };
    
    // Subscribe to app state change events
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [userToken, socket, isConnected]);
  
  // Provide context value
  const contextValue = {
    socket,
    isConnected,
    isConnecting,
    connect: initializeSocket,
    disconnect: cleanupSocket
  };
  
  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Export the context itself for direct usage
export { SocketContext };
