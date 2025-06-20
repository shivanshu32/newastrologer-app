import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

// Socket server URL - extract base URL from API_URL in api.js
//const SOCKET_SERVER_URL = 'http://192.168.29.107:5000';

const SOCKET_SERVER_URL = 'http://3.110.171.85';

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
  const isMounted = useRef(true); // Track if component is mounted
  
  // Initialize or reinitialize socket
  const initializeSocket = async () => {
    // Don't initialize if already connecting or no token available or component unmounted
    if (isConnecting || !userToken || !isMounted.current) return;
    
    try {
      setIsConnecting(true);
      
      // Get authentication data
      const token = await AsyncStorage.getItem('astrologerToken');
      const astrologerId = await AsyncStorage.getItem('astrologerId');
      
      if (!token || !astrologerId) {
        console.error('Token or astrologerId not found. Cannot initialize socket.');
        if (isMounted.current) {
          setIsConnecting(false);
        }
        return;
      }
      
      // Clean up existing socket if any
      if (socket) {
        cleanupSocket(false); // Don't update state during initialization
      }
      
      console.log('SocketContext: Initializing socket connection...');
      
      // Create new socket instance
      const newSocket = io(SOCKET_SERVER_URL, {
        auth: {
          token,
          astrologerId,
          userType: 'astrologer'
        },
        transports: ['websocket'],
        timeout: 10000,
        forceNew: true
      });
      
      // Set up event listeners
      newSocket.on('connect', () => {
        console.log('SocketContext: Socket connected successfully');
        if (isMounted.current) {
          setIsConnected(true);
          setIsConnecting(false);
          reconnectAttempts.current = 0;
          startPingInterval(newSocket);
        }
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log('SocketContext: Socket disconnected:', reason);
        if (isMounted.current) {
          setIsConnected(false);
          
          // Clear ping interval
          if (pingInterval.current) {
            clearInterval(pingInterval.current);
            pingInterval.current = null;
          }
          
          // Only attempt reconnect if disconnection wasn't intentional
          if (reason !== 'io client disconnect' && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            scheduleReconnect();
          }
        }
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('SocketContext: Connection error:', error);
        if (isMounted.current) {
          setIsConnecting(false);
          
          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            scheduleReconnect();
          }
        }
      });
      
      newSocket.on('error', (error) => {
        console.error('SocketContext: Socket error:', error);
      });
      
      // Set the socket in state only if component is still mounted
      if (isMounted.current) {
        setSocket(newSocket);
      } else {
        // Component was unmounted during initialization, clean up
        newSocket.disconnect();
      }
      
    } catch (error) {
      console.error('SocketContext: Error initializing socket:', error);
      if (isMounted.current) {
        setIsConnecting(false);
        
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect();
        }
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
      if (socketInstance && socketInstance.connected && isMounted.current) {
        console.log('SocketContext: Sending ping to keep connection alive');
        socketInstance.emit('ping');
      } else {
        console.log('SocketContext: Socket not connected, cannot send ping');
      }
    }, PING_INTERVAL);
  };
  
  // Schedule reconnection attempt
  const scheduleReconnect = () => {
    // Don't schedule reconnect if component is unmounted
    if (!isMounted.current) return;
    
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
      if (isMounted.current) {
        console.log(`SocketContext: Attempting reconnect #${reconnectAttempts.current}...`);
        initializeSocket();
      }
    }, delay);
  };
  
  // Clean up socket and related resources
  const cleanupSocket = (updateState = true) => {
    if (socket) {
      // Clear intervals
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }
      
      // Remove all listeners to prevent memory leaks
      socket.removeAllListeners();
      socket.disconnect();
      
      // Only update state if component is mounted and updateState is true
      if (isMounted.current && updateState) {
        setSocket(null);
        setIsConnected(false);
      }
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
      isMounted.current = false; // Mark component as unmounted
      
      // Clean up socket without updating state (component is unmounting)
      if (socket) {
        // Clear intervals
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
          pingInterval.current = null;
        }
        
        // Remove all listeners and disconnect
        socket.removeAllListeners();
        socket.disconnect();
      }
      
      // Clear timers
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [userToken]);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (!isMounted.current) return;
      
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
    disconnect: () => cleanupSocket(true)
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
