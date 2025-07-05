import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

// Socket Server URL Configuration - Comment/Uncomment as needed
// Local Development
// const SOCKET_SERVER_URL = 'http://192.168.29.107:5000';

// Production
//const SOCKET_SERVER_URL = 'http://3.110.171.85';

const SOCKET_SERVER_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app';

// Enhanced socket configuration for stability
const SOCKET_CONFIG = {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  maxReconnectionAttempts: 10,
  timeout: 20000,
  forceNew: false,
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true
};

// Create context
const SocketContext = createContext(null);

// Socket configuration constants
const PING_INTERVAL = 20000; // 20 seconds
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds

export const SocketProvider = ({ children }) => {
  const { userToken, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastSeen, setLastSeen] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connecting', 'connected', 'disconnected', 'reconnecting'
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const astrologerIdRef = useRef(null);
  const tokenRef = useRef(null);
  const isInitializingRef = useRef(false);
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
    // Don't initialize if already connecting or no token/astrologer available
    if (isConnecting || !userToken || !user) {
      console.log('⚠️ [SocketContext] Skipping socket init - connecting:', isConnecting, 'token:', !!userToken, 'astrologer:', !!user);
      return;
    }
    
    try {
      console.log('🚀 [SocketContext] Initializing socket connection...');
      setIsConnecting(true);
      
      // Get astrologer ID from the AuthContext user object
      const astrologerId = user._id || user.id;
      
      console.log('🔗 [SocketContext] Authentication data - token exists:', !!userToken, 'astrologerId:', astrologerId);
      
      // Store references for reconnection
      astrologerIdRef.current = astrologerId;
      tokenRef.current = userToken;
      
      if (!userToken || !astrologerId) {
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
          token: userToken,
          id: astrologerId,
          role: 'astrologer'
        },
        path: '/ws',
        ...SOCKET_CONFIG
      });
      
      // Store references for reconnection
      socketRef.current = newSocket;
      
      // Socket connection event handlers
      newSocket.on('connect', () => {
        console.log('🔗 [SOCKET] Astrologer connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionStatus('connected');
        setConnectionAttempts(0);
        reconnectAttempts.current = 0;
        isInitializingRef.current = false;
        
        // Clear any existing reconnect timer
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Start ping interval
        startPingInterval(newSocket);
        
        // Start heartbeat interval
        startHeartbeatInterval(newSocket);
        
        console.log('✅ [SOCKET] Astrologer socket ready to receive booking requests');
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('❌ [SOCKET] Astrologer connection error:', error);
        setIsConnecting(false);
        setConnectionStatus('disconnected');
        setConnectionAttempts(prev => prev + 1);
        isInitializingRef.current = false;
        
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          console.log(`🔄 [SOCKET] Scheduling reconnection attempt ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS}`);
          scheduleReconnect();
        } else {
          console.error('❌ [SOCKET] Max reconnection attempts reached');
          setConnectionStatus('failed');
        }
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log(`🔌 [SOCKET] Astrologer disconnected, reason: ${reason}`);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Clear ping interval
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
          pingInterval.current = null;
        }
        
        // Clear heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        
        // Only attempt reconnection for certain disconnect reasons and if we have valid credentials
        const shouldReconnect = [
          'transport close',
          'ping timeout',
          'transport error',
          'server disconnect'
        ].includes(reason) && astrologerIdRef.current && tokenRef.current;
        
        if (shouldReconnect && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          console.log(`🔄 [SOCKET] Scheduling reconnection for reason: ${reason}`);
          scheduleReconnect();
        } else if (reason === 'io client disconnect') {
          console.log('🔌 [SOCKET] Client initiated disconnect, not reconnecting');
        } else {
          console.log(`⚠️ [SOCKET] Not reconnecting for reason: ${reason}`);
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
        console.log('🏓 [PING] Sending ping to keep connection alive');
        socketInstance.emit('ping');
      } else {
        console.log('⚠️ [PING] Socket not connected, cannot send ping');
      }
    }, PING_INTERVAL);
  };
  
  // Start heartbeat interval to keep connection alive with ping/pong mechanism
  const startHeartbeatInterval = (socketInstance) => {
    // Clear existing interval if any
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    // Set up ping/pong heartbeat mechanism
    socketInstance.on('ping', () => {
      console.log('🏓 [HEARTBEAT] Received ping from server, sending pong');
      socketInstance.emit('pong');
      setLastSeen(Date.now());
    });
    
    // Set up new interval for client-side heartbeat
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketInstance && socketInstance.connected) {
        console.log('🏓 [HEARTBEAT] Sending astrologer heartbeat');
        socketInstance.emit('client_heartbeat', { timestamp: Date.now() });
        setLastSeen(Date.now());
      } else {
        console.log('⚠️ [HEARTBEAT] Socket not connected, cannot send heartbeat');
        // Attempt reconnection if socket is not connected
        if (!isInitializingRef.current) {
          scheduleReconnect();
        }
      }
    }, 30000); // 30 seconds
  };
  
  // Schedule reconnection attempt with exponential backoff
  const scheduleReconnect = () => {
    // Don't reconnect if already initializing or no credentials
    if (isInitializingRef.current || !astrologerIdRef.current || !tokenRef.current) {
      console.log('⚠️ [RECONNECT] Skipping reconnection - already initializing or no credentials');
      return;
    }
    
    // Clear any existing reconnect timer
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectAttempts.current += 1;
    setConnectionAttempts(reconnectAttempts.current);
    
    // Exponential backoff with jitter
    const baseDelay = RECONNECT_DELAY;
    const exponentialDelay = baseDelay * Math.pow(2, reconnectAttempts.current - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
    
    console.log(`🔄 [RECONNECT] Scheduling attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS} in ${Math.round(delay)}ms`);
    setConnectionStatus('reconnecting');
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (reconnectAttempts.current <= MAX_RECONNECT_ATTEMPTS && astrologerIdRef.current && tokenRef.current) {
        console.log(`🔄 [RECONNECT] Attempting reconnection ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}`);
        isInitializingRef.current = true;
        initializeSocket();
      } else {
        console.error('❌ [RECONNECT] Max attempts reached or no credentials available');
        setConnectionStatus('failed');
      }
    }, delay);
  };
  
  // Cleanup socket connection
  const cleanupSocket = () => {
    console.log('🧹 [CLEANUP] Cleaning up astrologer socket connection');
    
    if (socket || socketRef.current) {
      const socketToClean = socket || socketRef.current;
      
      // Clear all timers
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
      
      // Remove all listeners to prevent memory leaks
      socketToClean.removeAllListeners();
      socketToClean.disconnect();
      
      // Reset state
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      socketRef.current = null;
      reconnectAttempts.current = 0;
      setConnectionAttempts(0);
      isInitializingRef.current = false;
    }
  };
  
  // Initialize socket when auth token and astrologer are available
  useEffect(() => {
    if (userToken && user) {
      console.log('🚀 [SOCKET] Astrologer authenticated, initializing socket');
      initializeSocket();
    } else {
      console.log('⚠️ [SOCKET] No astrologer token/data, cleaning up socket if any');
      cleanupSocket();
    }
    
    // Clean up on unmount
    return () => {
      console.log('🧹 [SOCKET] Component unmounting, cleaning up');
      cleanupSocket();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [userToken, user]);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log('🔄 [APP_STATE] Changed from', appStateRef.current, 'to', nextAppState);
      
      // App has come to the foreground
      if (
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active' &&
        userToken && user
      ) {
        console.log('🔄 [APP_STATE] App foreground, checking socket connection');
        
        if (!socket || !isConnected) {
          console.log('🔄 [APP_STATE] Socket not connected, reinitializing');
          initializeSocket();
        }
      }
      
      appStateRef.current = nextAppState;
    };
    
    // Subscribe to app state change events
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [userToken, user, socket, isConnected]);
  
  // Provide context value
  const contextValue = {
    socket,
    isConnected,
    isConnecting,
    connectionStatus,
    connectionAttempts,
    lastSeen,
    initializeSocket,
    cleanupSocket
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
