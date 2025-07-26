import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import ChatConnectionManager from '../../utils/ChatConnectionManager';
import LocalSessionTimer from '../../utils/LocalSessionTimer';
import GlobalTimerState from '../../utils/GlobalTimerState';

const { width, height } = Dimensions.get('window');

// Utility function to format time
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const EnhancedChatScreen = ({ route, navigation }) => {
  // 🚨 ULTIMATE REMOUNT PREVENTION - Singleton pattern
  const guardBookingId = route?.params?.bookingId;
  const guardSessionId = route?.params?.sessionId;
  const guardAstrologerId = route?.params?.astrologerId;
  
  // Create a stable instance key based on critical props
  const instanceKey = `${guardBookingId}_${guardSessionId}_${guardAstrologerId}`;
  
  // Global initialization registry to prevent re-initialization
  if (!global.enhancedChatInitialized) {
    global.enhancedChatInitialized = new Map();
  }
  
  // Check if this session has already been initialized
  const isAlreadyInitialized = global.enhancedChatInitialized.get(instanceKey);
  
  // Track render count for debugging
  if (!global.enhancedChatRenderCount) {
    global.enhancedChatRenderCount = new Map();
  }
  const currentRenderCount = (global.enhancedChatRenderCount.get(instanceKey) || 0) + 1;
  global.enhancedChatRenderCount.set(instanceKey, currentRenderCount);
  
  console.log('🎆 [ULTIMATE-GUARD] Render attempt #' + currentRenderCount + ' for:', instanceKey);
  console.log('🎆 [ULTIMATE-GUARD] Already initialized:', isAlreadyInitialized);
  
  console.log('🔴 [ASTROLOGER-APP] ===== ENHANCED CHAT SCREEN COMPONENT MOUNTING =====');
  
  // Generate a unique component ID for this instance
  const componentId = useRef(`enhanced_chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`).current;
  console.log('🔴 [ASTROLOGER-APP] Component ID:', componentId);
  console.log('🔴 [ASTROLOGER-APP] Instance Key:', instanceKey);
  console.log('🔴 [ASTROLOGER-APP] Render #' + currentRenderCount + ' for session');
  
  // Enhanced mounting guard using global state to prevent duplicate initialization
  const mountingGuardRef = useRef(isAlreadyInitialized || false);
  const initializationCompleteRef = useRef(isAlreadyInitialized || false);
  const chatManagerInitializedRef = useRef(isAlreadyInitialized || false);
  
  // If already initialized globally, skip all initialization logic
  if (isAlreadyInitialized) {
    console.log('🚨 [ULTIMATE-GUARD] Session already initialized globally, skipping all init logic');
    console.log('🚨 [ULTIMATE-GUARD] Render #' + currentRenderCount + ' - using existing state');
    
    // Set all guards to prevent any initialization
    mountingGuardRef.current = true;
    initializationCompleteRef.current = true;
    chatManagerInitializedRef.current = true;
  } else {
    console.log('🎆 [ULTIMATE-GUARD] First initialization for session:', instanceKey);
    // Mark as initialized globally
    global.enhancedChatInitialized.set(instanceKey, true);
  }
  
  console.log('🔴 [ASTROLOGER-APP] Mounting guard status:', mountingGuardRef.current);
  console.log('🔴 [ASTROLOGER-APP] Initialization complete:', initializationCompleteRef.current);
  console.log('🚨 [REMOUNT-DEBUG] Component mount timestamp:', Date.now());
  console.log('🚨 [REMOUNT-DEBUG] Mount count for this session:', (global.enhancedChatMountCount = (global.enhancedChatMountCount || 0) + 1));
  console.log('🚨 [REMOUNT-DEBUG] Stack trace:', new Error().stack?.split('\n').slice(0, 5));
  console.log('🔴 [ASTROLOGER-APP] Route object:', route);
  console.log('🔴 [ASTROLOGER-APP] Route params:', route?.params);
  
  const { 
    bookingId, 
    astrologerId, 
    sessionId, 
    bookingDetails: routeBookingDetails,
    // Free chat specific parameters
    isFreeChat,
    freeChatId,
    userInfo: routeUserInfo
  } = route.params || {};
  
  // 🚨 DEBUG: Track props changes that might cause remounts
  const propsHash = JSON.stringify({ bookingId, astrologerId, sessionId, isFreeChat, freeChatId });
  const prevPropsRef = useRef(propsHash);
  if (prevPropsRef.current !== propsHash) {
    console.log('🚨 [REMOUNT-DEBUG] 🚨 PROPS CHANGED - POTENTIAL REMOUNT CAUSE!');
    console.log('🚨 [REMOUNT-DEBUG] Previous props:', prevPropsRef.current);
    console.log('🚨 [REMOUNT-DEBUG] New props:', propsHash);
    prevPropsRef.current = propsHash;
  }
  
  console.log('🔴 [ASTROLOGER-APP] Extracted params:');
  console.log('🔴 [ASTROLOGER-APP] - bookingId:', bookingId);
  console.log('🔴 [ASTROLOGER-APP] - astrologerId:', astrologerId);
  console.log('🔴 [ASTROLOGER-APP] - sessionId:', sessionId);
  console.log('🔴 [ASTROLOGER-APP] - routeBookingDetails:', routeBookingDetails);
  console.log('🔴 [ASTROLOGER-APP] - isFreeChat:', isFreeChat);
  console.log('🔴 [ASTROLOGER-APP] - freeChatId:', freeChatId);
  console.log('🔴 [ASTROLOGER-APP] - routeUserInfo:', routeUserInfo);
  
  // Session type detection will be calculated inside useEffect to prevent remounts
  console.log('🔴 [ASTROLOGER-APP] Session type detection will be calculated in ChatConnectionManager useEffect');
  
  // State management
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [bookingDetails, setBookingDetails] = useState(null);
  
  // Global timer state for frontend display (prevents resets on remount)
  // Initialize with current GlobalTimerState data to prevent flicker
  const [timerData, setTimerData] = useState(() => {
    if (sessionId) {
      const globalData = GlobalTimerState.getTimerData(sessionId);
      console.log('🎨 [TIMER-INIT] Initializing timer state with global data:', globalData);
      return {
        ...globalData,
        elapsedSeconds: globalData.elapsed,
        isCountdown: false,
        remainingSeconds: 0,
        currentAmount: 0,
        currency: '₹'
      };
    }
    return {
      isActive: false,
      elapsed: 0,
      elapsedSeconds: 0,
      isCountdown: false,
      remainingSeconds: 0,
      currentAmount: 0,
      currency: '₹'
    };
  });
  
  // Get persistent timer data from GlobalTimerState
  const getGlobalTimerData = useCallback(() => {
    if (sessionId) {
      return GlobalTimerState.getTimerData(sessionId);
    }
    return { isActive: false, elapsed: 0 };
  }, [sessionId]);
  
  // Refs
  const chatManagerRef = useRef(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageIdCounter = useRef(0);
  const timerRef = useRef(null);
  const lastTimerUpdateRef = useRef(0); // Track last timer update to prevent flicker

  // Global timer callbacks with enhanced flicker prevention and reduced re-renders
  const handleGlobalTimerTick = useCallback((elapsed) => {
    // Always update the ref immediately (no re-render)
    const formattedTime = formatTime(elapsed);
    timerDisplayRef.current = { time: formattedTime, elapsed };
    
    // Only update component state every 5 seconds or for first few seconds to reduce re-renders
    const shouldUpdateState = elapsed <= 5 || elapsed % 5 === 0;
    
    if (!shouldUpdateState) {
      // Log every 10 seconds to reduce console noise
      if (elapsed % 10 === 0) {
        console.log('🔄 [TIMER] Tick (ref only):', elapsed);
      }
      return;
    }
    
    const now = Date.now();
    // Throttle state updates to prevent excessive re-renders (max 1 update per 800ms)
    if (now - lastTimerUpdateRef.current < 800) {
      return;
    }
    
    console.log('🔄 [TIMER] GlobalTimerState tick with state update:', elapsed);
    
    setTimerData(prev => {
      // Enhanced flicker prevention - check for meaningful changes
      if (prev.elapsedSeconds === elapsed && prev.isActive === true) {
        console.log('⏭️ [TIMER] Skipping duplicate timer update');
        return prev;
      }
      
      console.log('✅ [TIMER] Updating timer state:', { elapsed, isActive: true });
      lastTimerUpdateRef.current = now;
      return {
        ...prev,
        elapsed: elapsed,
        elapsedSeconds: elapsed,
        isActive: true
      };
    });
  }, []); // EMPTY DEPENDENCY ARRAY - STABLE

  const handleGlobalTimerWarning = useCallback(() => {
    console.log(`⚠️ [GLOBAL-TIMER] Timer warning at 3 minutes`);
    Alert.alert('Session Warning', '⚠️ 3 minutes elapsed! Session will end soon.');
  }, []); // STABLE - NO DEPENDENCIES

  const handleGlobalTimerEnd = useCallback(() => {
    console.log(`⏹️ [GLOBAL-TIMER] Timer ended at 5 minutes`);
    Alert.alert('Session Completed', '⏰ Session time completed!');
    // Handle session end logic here
  }, []); // STABLE - NO DEPENDENCIES

  // Simple timer functions (now using GlobalTimerState)
  const startSimpleTimer = useCallback(() => {
    if (!sessionId) return;
    
    console.log(`▶️ [GLOBAL-TIMER] Starting timer for session ${sessionId}`);
    
    // Register this component instance with GlobalTimerState
    GlobalTimerState.registerInstance(sessionId, componentId, {
      onTick: handleGlobalTimerTick,
      onWarning: handleGlobalTimerWarning,
      onEnd: handleGlobalTimerEnd
    });
    
    // Start the global timer
    GlobalTimerState.startTimer(sessionId);
    
    // Update local state to reflect current global state
    const globalData = GlobalTimerState.getTimerData(sessionId);
    setTimerData({
      ...globalData,
      elapsedSeconds: globalData.elapsed, // Add elapsedSeconds for display compatibility
      isCountdown: false,
      remainingSeconds: 0,
      currentAmount: 0,
      currency: '₹'
    });
  }, [sessionId, handleGlobalTimerTick, handleGlobalTimerWarning, handleGlobalTimerEnd]);

  const stopSimpleTimer = useCallback(() => {
    if (!sessionId) return;
    
    console.log(` [GLOBAL-TIMER] Stopping timer for session ${sessionId}`);
    console.log(`⏹️ [GLOBAL-TIMER] Stopping timer for session ${sessionId}`);
    GlobalTimerState.stopTimer(sessionId);
    
    setTimerData(prev => ({ ...prev, isActive: false }));
  }, [sessionId]);

  // Immediate timer sync on component mount to prevent flicker
  useEffect(() => {
    if (!sessionId) return;
    
    // Immediately sync with GlobalTimerState to prevent display flicker
    const globalData = GlobalTimerState.getTimerData(sessionId);
    console.log('🎨 [TIMER-SYNC] Immediate timer sync on mount:', globalData);
    
    if (globalData.isActive || globalData.elapsed > 0) {
      setTimerData({
        ...globalData,
        elapsedSeconds: globalData.elapsed,
        isCountdown: false,
        remainingSeconds: 0,
        currentAmount: 0,
        currency: '₹'
      });
      
      // Register this instance if timer is active
      if (globalData.isActive) {
        GlobalTimerState.registerInstance(sessionId, componentId, {
          onTick: handleGlobalTimerTick,
          onWarning: handleGlobalTimerWarning,
          onEnd: handleGlobalTimerEnd
        });
      }
    }
  }, [sessionId, componentId]); // Run once on mount when sessionId is available
  
  // Start/stop global timer when session becomes active/inactive
  useEffect(() => {
    if (!sessionId) return;
    
    if (sessionActive) {
      // Check if timer is already running in GlobalTimerState
      const globalData = GlobalTimerState.getTimerData(sessionId);
      
      if (!globalData.isActive) {
        console.log('🔴 [ASTROLOGER-APP] Starting global timer for active session');
        console.log('🔴 [ASTROLOGER-APP] Component ID:', componentId);
        startSimpleTimer();
      } else {
        console.log('🔴 [ASTROLOGER-APP] Global timer already running, registering instance');
        // Register this instance with the already running timer
        GlobalTimerState.registerInstance(sessionId, componentId, {
          onTick: handleGlobalTimerTick,
          onWarning: handleGlobalTimerWarning,
          onEnd: handleGlobalTimerEnd
        });
        
        // Update local state to reflect current global state
        setTimerData({
          ...globalData,
          elapsedSeconds: globalData.elapsed, // Add elapsedSeconds for display compatibility
          isCountdown: false,
          remainingSeconds: 0,
          currentAmount: 0,
          currency: '₹'
        });
      }
    } else {
      console.log('🔴 [ASTROLOGER-APP] Session not active, ensuring timer is stopped');
      // Don't stop the global timer here - let it continue for other instances
      // Just update local state
      setTimerData(prev => ({ ...prev, isActive: false }));
    }
  }, [sessionActive, sessionId, handleGlobalTimerTick, handleGlobalTimerWarning, handleGlobalTimerEnd]); // Include callback dependencies

  // Removed force activate timer as it was causing timer resets
  // Timer should be activated naturally through backend events and session state

  // Function to fetch booking details with user information
  const fetchBookingDetails = useCallback(async () => {
    if (!bookingId) {
      console.log('🔴 [ASTROLOGER-APP] No bookingId provided, skipping booking details fetch');
      return;
    }

    try {
      console.log('🔴 [ASTROLOGER-APP] Fetching booking details for bookingId:', bookingId);
      
      // Get astrologer token for API authentication
      const astrologerData = await AsyncStorage.getItem('astrologerData');
      const parsedData = astrologerData ? JSON.parse(astrologerData) : null;
      const token = parsedData?.token;
      
      if (!token) {
        console.error('🔴 [ASTROLOGER-APP] No astrologer token found');
        return;
      }

      const response = await fetch(`http://192.168.1.8:5000/api/bookings/${bookingId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const booking = await response.json();
        console.log('🔴 [ASTROLOGER-APP] Booking details fetched:', booking);
        
        setBookingDetails(booking);
        
        // Extract user information from booking
        if (booking.userInfo) {
          console.log('🔴 [ASTROLOGER-APP] User info found:', booking.userInfo);
          setUserInfo(booking.userInfo);
        } else {
          console.log('🔴 [ASTROLOGER-APP] No user info found in booking');
        }
      } else {
        console.error('🔴 [ASTROLOGER-APP] Failed to fetch booking details:', response.status);
      }
    } catch (error) {
      console.error('🔴 [ASTROLOGER-APP] Error fetching booking details:', error);
    }
  }, [bookingId]);

  // Frontend timer management functions
  const handleTimerTick = useCallback((data) => {
    console.log('🔴 [ASTROLOGER-APP] Frontend timer tick:', data);
    setTimerData({
      isActive: true,
      elapsedSeconds: data.elapsedSeconds,
      remainingSeconds: data.remainingSeconds,
      isCountdown: data.isCountdown,
      currentAmount: data.currentAmount?.toFixed(2) || '0.00',
      currency: '₹',
      warnings: data.warnings || []
    });
  }, []);

  const handleTimerWarning = useCallback((data) => {
    console.log('🔴 [ASTROLOGER-APP] Frontend timer warning:', data);
    Alert.alert(
      'Session Warning',
      `${data.message}\n\nTime remaining: ${Math.floor(data.remainingSeconds / 60)}:${(data.remainingSeconds % 60).toString().padStart(2, '0')}`,
      [{ text: 'OK' }]
    );
  }, []);

  const handleTimerEnd = useCallback(async () => {
    console.log('🔴 [ASTROLOGER-APP] Frontend timer ended - auto-ending session');
    
    // Update timer state to inactive
    setTimerData(prev => ({ ...prev, isActive: false }));
    
    // End session via socket
    if (chatManagerRef.current?.socket) {
      console.log('🔴 [ASTROLOGER-APP] Emitting end_session via socket');
      chatManagerRef.current.socket.emit('end_session', {
        bookingId,
        sessionId,
        astrologerId,
        reason: 'timer_expired'
      });
    }
    
    // Show session ended alert
    Alert.alert(
      'Session Ended',
      'The consultation session has ended due to time expiry.',
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              })
            );
          }
        }
      ]
    );
  }, [bookingId, sessionId, astrologerId, navigation]);

  const startFrontendTimer = useCallback((sessionData) => {
    console.log('🔴 [ASTROLOGER-APP] Starting frontend timer with data:', sessionData);
    
    try {
      LocalSessionTimer.startTimer({
        sessionId: sessionData.sessionId,
        startTime: sessionData.startTime,
        totalDurationMinutes: sessionData.totalDurationMinutes,
        walletBalance: sessionData.walletBalance,
        ratePerMinute: sessionData.ratePerMinute,
        onTick: handleTimerTick,
        onWarning: handleTimerWarning,
        onEnd: handleTimerEnd
      });
      
      console.log('🔴 [ASTROLOGER-APP] Frontend timer started successfully');
    } catch (error) {
      console.error('🔴 [ASTROLOGER-APP] Failed to start frontend timer:', error);
    }
  }, [handleTimerTick, handleTimerWarning, handleTimerEnd]);

  const stopFrontendTimer = useCallback(() => {
    console.log('🔴 [ASTROLOGER-APP] Stopping frontend timer');
    LocalSessionTimer.stopTimer();
    setTimerData(prev => ({ ...prev, isActive: false }));
    
    // Stop global timer if this session is active
    if (sessionId) {
      GlobalTimerState.stopTimer(sessionId);
    }
  }, [sessionId]);

  const handleManualEndSession = useCallback(async () => {
    console.log('🔴 [ASTROLOGER-APP] Manual session end triggered');
    
    Alert.alert(
      'End Session',
      'Are you sure you want to end this consultation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            // Stop frontend timer
            stopFrontendTimer();
            
            // End session via socket
            if (chatManagerRef.current?.socket) {
              console.log('🔴 [ASTROLOGER-APP] Emitting end_session via socket');
              chatManagerRef.current.socket.emit('end_session', {
                bookingId,
                sessionId,
                astrologerId,
                reason: 'manual_end'
              });
            }
          }
        }
      ]
    );
  }, [bookingId, sessionId, astrologerId, stopFrontendTimer]);

  // AppState handling for background/foreground transitions
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log('🔴 [ASTROLOGER-APP] App state changed:', nextAppState);
      
      if (nextAppState === 'active' && sessionActive && chatManagerRef.current) {
        console.log('🔴 [ASTROLOGER-APP] App returned to foreground - requesting timer sync');
        
        // Request session state sync to ensure timer is accurate
        if (chatManagerRef.current.socket && chatManagerRef.current.socket.connected) {
          console.log('🔴 [ASTROLOGER-APP] Requesting session state sync after foreground');
          chatManagerRef.current.socket.emit('get_session_state', {
            bookingId: bookingId,
            sessionId: sessionId,
            astrologerId: astrologerId,
            isFreeChat: isFreeChatSession,
            freeChatId: actualFreeChatId
          });
        }
        
        // Also request timer sync specifically
        setTimeout(() => {
          if (chatManagerRef.current?.socket?.connected) {
            console.log('🔴 [ASTROLOGER-APP] Requesting timer sync after foreground delay');
            chatManagerRef.current.socket.emit('sync_timer', {
              bookingId: bookingId,
              sessionId: sessionId
            });
          }
        }, 1000);
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [bookingId, sessionId, astrologerId]); // 🔧 CRITICAL FIX: Removed sessionActive and computed values to prevent rapid remounting

  // Focus effect to resume timer when screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔴 [ASTROLOGER-APP] Screen gained focus - checking timer state');
      
      if (sessionId) {
        // Resume global timer if it exists
        const resumed = GlobalTimerState.resumeTimer(sessionId, {
          onTick: handleGlobalTimerTick,
          onWarning: handleGlobalTimerWarning,
          onEnd: handleGlobalTimerEnd
        });
        
        if (resumed) {
          console.log('🔴 [ASTROLOGER-APP] Global timer resumed successfully');
        } else {
          console.log('🔴 [ASTROLOGER-APP] No global timer to resume');
        }
        
        // Update local state with current global timer data
        const globalData = GlobalTimerState.getTimerData(sessionId);
        setTimerData(globalData);
      }
    }, [sessionId]) // 🔧 CRITICAL FIX: Removed callback dependencies to prevent rapid remounting
  );

  // Component lifecycle logging
  useEffect(() => {
    console.log('🔴 [ASTROLOGER-APP] ===== ENHANCED CHAT SCREEN MOUNTED =====');
    console.log('🔴 [ASTROLOGER-APP] Component mounted with params:', { bookingId, astrologerId, sessionId });
    
    // Initialize userInfo and bookingDetails from route params first
    if (routeBookingDetails) {
      console.log('🔴 [ASTROLOGER-APP] Setting booking details from route params:', routeBookingDetails);
      setBookingDetails(routeBookingDetails);
      
      if (routeBookingDetails.userInfo) {
        console.log('🔴 [ASTROLOGER-APP] Setting user info from route params:', routeBookingDetails.userInfo);
        setUserInfo(routeBookingDetails.userInfo);
      } else {
        console.log('🔴 [ASTROLOGER-APP] No userInfo found in route booking details');
      }
    } else {
      console.log('🔴 [ASTROLOGER-APP] No booking details in route params, will fetch from API');
      // Fallback to API fetch if no route params
      fetchBookingDetails();
    }
    
    return () => {
      console.log('🔴 [ASTROLOGER-APP] ===== ENHANCED CHAT SCREEN UNMOUNTING =====');
    };
  }, []); // 🔧 CRITICAL FIX: Run only once on mount to prevent remounting from route changes

  // ChatConnectionManager initialization and setup
  useEffect(() => {
    console.log('🔴 [ASTROLOGER-APP] ===== INITIALIZING CHAT CONNECTION MANAGER =====');
    console.log('🚨 [REMOUNT-DEBUG] ChatConnectionManager useEffect triggered');
    console.log('🚨 [REMOUNT-DEBUG] Stable dependencies:', { bookingId, astrologerId, sessionId });
    console.log('🔴 [ASTROLOGER-APP] Component ID:', componentId);
    
    // Strong guard against multiple initializations
    if (mountingGuardRef.current || chatManagerInitializedRef.current) {
      console.log('🔴 [ASTROLOGER-APP] ⚠️ Skipping initialization - already mounting or initialized');
      return;
    }
    
    // Calculate computed values inside the effect to avoid dependency issues
    const currentIsFreeChat = isFreeChat || (routeBookingDetails && routeBookingDetails.isFreeChat);
    const currentFreeChatId = freeChatId || (routeBookingDetails && routeBookingDetails.freeChatId) || (currentIsFreeChat ? bookingId : null);
    
    if (!bookingId && !currentFreeChatId) {
      console.error('🔴 [ASTROLOGER-APP] ❌ Missing required booking/session ID');
      return;
    }
    
    if (!astrologerId) {
      console.error('🔴 [ASTROLOGER-APP] ❌ Missing astrologer ID');
      return;
    }
    
    // Set both guards to prevent duplicate initialization
    mountingGuardRef.current = true;
    chatManagerInitializedRef.current = true;
    
    const initializeChatManager = async () => {
      try {
        // Get astrologer data for initialization
        const astrologerData = await AsyncStorage.getItem('astrologerData');
        const parsedData = astrologerData ? JSON.parse(astrologerData) : null;
        const currentAstrologerId = parsedData?.id || astrologerId;
        
        if (!currentAstrologerId) {
          console.error('🔴 [ASTROLOGER-APP] No astrologer ID available for chat initialization');
          return;
        }
        
        console.log('🔴 [ASTROLOGER-APP] Creating ChatConnectionManager instance');
        
        // Create ChatConnectionManager instance
        chatManagerRef.current = new ChatConnectionManager();
        
        // Set up callbacks for connection status updates
        chatManagerRef.current.onConnectionStatus(handleConnectionStatus);
        
        // Set up callbacks for new messages
        chatManagerRef.current.onMessage(handleNewMessage);
        
        // Set up callbacks for typing status
        chatManagerRef.current.onTyping(handleTypingStatus);
        
        // Set up callbacks for status updates (timer, session events, etc.)
        chatManagerRef.current.onStatusUpdate(handleStatusUpdate);
        
        console.log('🔴 [ASTROLOGER-APP] ChatConnectionManager callbacks configured');
        
        // Initialize the connection manager with correct parameter order
        // astrologer-app ChatConnectionManager.initialize(bookingId, astrologerId, userId, options)
        const initOptions = {
          isFreeChat: currentIsFreeChat,
          sessionId: sessionId,
          freeChatId: currentFreeChatId
        };
        
        console.log('🔴 [ASTROLOGER-APP] Initializing ChatConnectionManager with options:', initOptions);
        
        await chatManagerRef.current.initialize(
          bookingId || currentFreeChatId, // bookingId parameter
          currentAstrologerId, // astrologerId parameter
          null, // userId parameter (not needed for astrologer)
          initOptions // options parameter
        );
        
        console.log('🔴 [ASTROLOGER-APP] ✅ ChatConnectionManager initialized successfully');
        
        // Mark initialization as complete to allow message processing
        initializationCompleteRef.current = true;
        
      } catch (error) {
        console.error('🔴 [ASTROLOGER-APP] ❌ Failed to initialize ChatConnectionManager:', error);
        setConnectionStatus('failed');
        setConnectionMessage('Failed to initialize chat connection');
        // Reset initialization flag on error
        initializationCompleteRef.current = false;
      }
    };
    
    // Initialize chat manager
    initializeChatManager();
    
    // Cleanup on unmount
    return () => {
      console.log('🔴 [ASTROLOGER-APP] Cleaning up ChatConnectionManager');
      console.log('🔴 [ASTROLOGER-APP] Component ID:', componentIdRef.current);
      
      // Unregister from GlobalTimerState
      if (sessionId) {
        GlobalTimerState.unregisterInstance(sessionId, componentId);
      }
      
      // Reset all guards to allow re-initialization if component remounts
      mountingGuardRef.current = false;
      chatManagerInitializedRef.current = false;
      initializationCompleteRef.current = false;
      
      if (chatManagerRef.current) {
        chatManagerRef.current.disconnect();
        chatManagerRef.current = null;
      }
    };
  }, [bookingId, astrologerId, sessionId]); // 🔧 CRITICAL FIX: Only stable, primitive dependencies to prevent remounts

  // Handle keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardHeight(event.endCoordinates.height);
        setIsKeyboardVisible(true);
        // Scroll to bottom when keyboard shows
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Handle connection status updates
  const handleConnectionStatus = useCallback((status) => {
    console.log('🔴 [ASTROLOGER-APP] ===== CONNECTION STATUS UPDATE =====');
    console.log('🔴 [ASTROLOGER-APP] Status:', status.status);
    console.log('🔴 [ASTROLOGER-APP] Message:', status.message);
    console.log('🔴 [ASTROLOGER-APP] Full status object:', status);
    
    setConnectionStatus(status.status);
    setConnectionMessage(status.message || '');
    
    if (status.status === 'connected') {
      console.log('🔴 [ASTROLOGER-APP] ✅ Chat connected successfully');
    } else if (status.status === 'error' || status.status === 'failed') {
      console.error('🔴 [ASTROLOGER-APP] ❌ Chat connection error:', status.message);
    } else if (status.status === 'connecting') {
      console.log('🔴 [ASTROLOGER-APP] 🔄 Chat connecting...');
    } else if (status.status === 'disconnected') {
      console.log('🔴 [ASTROLOGER-APP] 🔌 Chat disconnected');
    } else if (status.status === 'session_rejoined') {
      console.log('🔴 [ASTROLOGER-APP] 🔄 Session rejoined after reconnection');
      
      // For free chat sessions, we should request message history after rejoining
      if (isFreeChatSession) {
        console.log('🔴 [ASTROLOGER-APP] Free chat session rejoined - requesting message history');
        requestMessageHistory();
      }
    }
  }, []);

  // Handle new messages with enhanced validation
  const handleNewMessage = useCallback((message) => {
    console.log('🔴 [ASTROLOGER-APP] ===== NEW MESSAGE RECEIVED =====');
    console.log('🔴 [ASTROLOGER-APP] Message ID:', message.id);
    console.log('🔴 [ASTROLOGER-APP] Message content field:', message.content);
    console.log('🔴 [ASTROLOGER-APP] Message text field:', message.text);
    console.log('🔴 [ASTROLOGER-APP] Message message field:', message.message);
    console.log('🔴 [ASTROLOGER-APP] Message sender:', message.sender);
    console.log('🔴 [ASTROLOGER-APP] Full message object:', JSON.stringify(message, null, 2));
    
    // Prevent processing messages during component instability
    if (!initializationCompleteRef.current) {
      console.log('🔴 [ASTROLOGER-APP] ⚠️ Skipping message processing - component not fully initialized');
      return;
    }
    
    // Extract content with detailed logging
    let extractedContent = '';
    if (message.content && typeof message.content === 'string' && message.content.trim()) {
      extractedContent = message.content.trim();
      console.log('🔴 [ASTROLOGER-APP] Using content field:', extractedContent);
    } else if (message.text && typeof message.text === 'string' && message.text.trim()) {
      extractedContent = message.text.trim();
      console.log('🔴 [ASTROLOGER-APP] Using text field:', extractedContent);
    } else if (message.message && typeof message.message === 'string' && message.message.trim()) {
      extractedContent = message.message.trim();
      console.log('🔴 [ASTROLOGER-APP] Using message field:', extractedContent);
    } else {
      console.error('🔴 [ASTROLOGER-APP] No valid message content found - ignoring message:', {
        id: message.id,
        content: message.content,
        text: message.text,
        message: message.message,
        sender: message.sender
      });
      return; // Don't add empty messages to state
    }
    
    // Normalize message to ensure consistent structure
    const normalizedMessage = {
      ...message,
      // Use the extracted content for all fields
      content: extractedContent,
      text: extractedContent,
      message: extractedContent,
      // Ensure we have required fields
      id: message.id || `msg_${Date.now()}_${Math.random()}`,
      timestamp: message.timestamp || new Date().toISOString(),
      sender: message.sender || message.senderRole || 'unknown',
      senderId: message.senderId || message.sender || 'unknown'
    };
    
    console.log('🔴 [ASTROLOGER-APP] Final normalized message content:', normalizedMessage.content);
    console.log('🔴 [ASTROLOGER-APP] Final normalized message text:', normalizedMessage.text);
    console.log('🔴 [ASTROLOGER-APP] Final normalized message message:', normalizedMessage.message);
    
    setMessages(prevMessages => {
      // Enhanced deduplication logic
      // Check for exact ID match first
      const exactIdExists = prevMessages.some(msg => msg.id === normalizedMessage.id);
      if (exactIdExists) {
        console.log('🔴 [ASTROLOGER-APP] Duplicate message ignored (exact ID):', normalizedMessage.id);
        return prevMessages;
      }
      
      // Check for content-based duplication (same sender, content, and similar timestamp)
      // This handles cases where backend echo has different ID than optimistic UI
      const contentDuplicate = prevMessages.some(msg => {
        const isSameSender = msg.senderId === normalizedMessage.senderId;
        const isSameContent = msg.content === normalizedMessage.content;
        const timeDiff = Math.abs(new Date(msg.timestamp).getTime() - new Date(normalizedMessage.timestamp).getTime());
        const isSimilarTime = timeDiff < 5000; // Within 5 seconds
        
        return isSameSender && isSameContent && isSimilarTime;
      });
      
      if (contentDuplicate) {
        console.log('🔴 [ASTROLOGER-APP] Duplicate message ignored (content-based):', {
          content: normalizedMessage.content,
          senderId: normalizedMessage.senderId,
          timestamp: normalizedMessage.timestamp
        });
        return prevMessages;
      }
      
      console.log('🔴 [ASTROLOGER-APP] Adding message to state with content:', normalizedMessage.content);
      
      // Add message without sorting to prevent blocking
      const newMessages = [...prevMessages, normalizedMessage];
      
      console.log('🔴 [ASTROLOGER-APP] Total messages in state:', newMessages.length);
      console.log('🔴 [ASTROLOGER-APP] Last message content:', newMessages[newMessages.length - 1]?.content);
      
      // Auto-scroll to bottom immediately for instant message display
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 0);
      
      return newMessages;
    });

    // Mark message as read if it's from user (non-blocking)
    if (normalizedMessage.senderId !== astrologerId && chatManagerRef.current) {
      setTimeout(() => {
        chatManagerRef.current.markMessageAsRead(normalizedMessage.id);
      }, 0);
    }
  }, [astrologerId]);

  // Handle typing status updates
  const handleTypingStatus = useCallback((isTyping, data) => {
    console.log('🔴 [ASTROLOGER-APP] Typing status:', { isTyping, data });
    setUserTyping(isTyping);
  }, []);

  // Handle typing input
  const handleTypingInput = useCallback((text) => {
    setNewMessage(text);
    
    // Send typing indicator
    if (chatManagerRef.current) {
      chatManagerRef.current.sendTypingStatus(true);
      
      // Clear typing indicator after 2 seconds
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (chatManagerRef.current) {
          chatManagerRef.current.sendTypingStatus(false);
        }
      }, 2000);
    }
  }, []);
  
  // Handle ending the session when End button is clicked
  const handleEndSession = useCallback(() => {
    console.log('🛑 [ASTROLOGER-APP] End session button clicked');
    
    if (!chatManagerRef.current) {
      console.error('🛑 [ASTROLOGER-APP] Cannot end session - chat manager not initialized');
      Alert.alert('Error', 'Cannot end session at this time. Please try again.');
      return;
    }
    
    // Confirm with the astrologer before ending the session
    Alert.alert(
      'End Session',
      'Are you sure you want to end this chat session?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            console.log('🛑 [ASTROLOGER-APP] End session confirmed');
            
            // Use the sessionId from state or route params
            const actualSessionId = sessionId || route.params?.sessionId;
            
            // Call endSession on the chat manager
            const success = chatManagerRef.current.endSession(actualSessionId);
            
            if (success) {
              console.log('🛑 [ASTROLOGER-APP] Session end request sent successfully');
              console.log('🛑 [ASTROLOGER-APP] Waiting for backend confirmation...');
              // The session_end event from the socket will handle UI updates and navigation
              // Do NOT navigate away immediately - wait for backend confirmation
            } else {
              console.error('🛑 [ASTROLOGER-APP] Failed to send session end request');
              Alert.alert('Error', 'Failed to end session. Please try again.');
            }
          }
        }
      ]
    );
  }, [sessionId, route.params]);

  // Handle status updates from backend
  const handleStatusUpdate = useCallback((data) => {
    console.log('🔄 [TIMER] Status update received:', data);
    
    // 🔍 DEBUG: Check if this is happening around 3-second mark
    const currentElapsed = data.elapsedSeconds || 0;
    if (currentElapsed >= 2 && currentElapsed <= 5) {
      console.log('🚨 [3-SEC-DEBUG] Backend status update at critical timing!');
      console.log('🚨 [3-SEC-DEBUG] Data received:', JSON.stringify(data, null, 2));
      console.log('🚨 [3-SEC-DEBUG] Current component state - initialized:', initializationCompleteRef.current);
    }
    
    if (data.type === 'timer' || data.type === 'session_timer') {
      console.log('🔄 [ASTROLOGER-APP] Backend timer update received:', data);
      
      // More flexible timer validation to handle booking ID mismatches
      const updateBookingId = data.bookingId || data.sessionId;
      const currentBookingId = bookingId; // Use only the route bookingId
      
      console.log('🔄 [ASTROLOGER-APP] Timer validation debug:', {
        'data.bookingId': data.bookingId,
        'data.sessionId': data.sessionId,
        'updateBookingId': updateBookingId,
        'route.bookingId': bookingId,
        'currentBookingId': currentBookingId,
        'astrologerId': astrologerId,
        'data.astrologerId': data.astrologerId,
        'strictMatch': updateBookingId === currentBookingId
      });
      
      // Check if this timer update is for the current astrologer and session context
      let shouldAcceptUpdate = false;
      
      // Primary validation: exact booking/session ID match
      if (updateBookingId && currentBookingId && updateBookingId === currentBookingId) {
        shouldAcceptUpdate = true;
        console.log('🔄 [ASTROLOGER-APP] ✅ Timer update accepted - exact ID match');
      }
      // Secondary validation: same astrologer and we're in an active session
      else if (data.astrologerId && astrologerId && data.astrologerId === astrologerId && sessionActive) {
        shouldAcceptUpdate = true;
        console.log('🔄 [ASTROLOGER-APP] ✅ Timer update accepted - same astrologer, active session');
        
        // Update our local booking ID to match the backend
        console.log('🔄 [ASTROLOGER-APP] Updating local booking ID from', currentBookingId, 'to', updateBookingId);
      }
      // Fallback: if we're in a consultation screen and timer is active, accept updates
      else if (sessionActive && timerData.isActive) {
        shouldAcceptUpdate = true;
        console.log('🔄 [ASTROLOGER-APP] ✅ Timer update accepted - active session fallback');
      }
      
      if (!shouldAcceptUpdate) {
        console.log('🔴 [ASTROLOGER-APP] ❌ Timer update ignored - validation failed:', {
          currentBookingId,
          eventBookingId: updateBookingId,
          astrologerId,
          eventAstrologerId: data.astrologerId,
          sessionActive,
          timerActive: timerData.isActive
        });
        return;
      }
      
      // Only sync with backend if there's a significant difference (>2 seconds)
      // This prevents backend updates from interfering with frontend timer increments
      setTimerData(prev => {
        const backendElapsed = data.elapsedSeconds || 0;
        const frontendElapsed = prev.elapsedSeconds || 0;
        const timeDifference = Math.abs(backendElapsed - frontendElapsed);
        
        // 🚨 DEBUG: Log backend sync attempts around 3-second mark
        if (backendElapsed >= 2 && backendElapsed <= 6) {
          console.log('🚨 [3-SEC-DEBUG] Backend sync attempt!');
          console.log('🚨 [3-SEC-DEBUG] Backend elapsed:', backendElapsed);
          console.log('🚨 [3-SEC-DEBUG] Frontend elapsed:', frontendElapsed);
          console.log('🚨 [3-SEC-DEBUG] Time difference:', timeDifference);
          console.log('🚨 [3-SEC-DEBUG] Timer active:', prev.isActive);
          console.log('🚨 [3-SEC-DEBUG] Will sync?', (!prev.isActive || timeDifference > 5));
        }
        
        // 🔧 FIXED: Prevent backend sync interference with smooth local timer
        // Only sync if timer is not active locally OR if there's a major desync (>5 seconds)
        // This prevents the 3-second flicker caused by backend sync conflicts
        if (!prev.isActive || timeDifference > 5) {
          console.log('🔄 [ASTROLOGER-APP] Major timer sync needed:', {
            backend: backendElapsed,
            frontend: frontendElapsed,
            difference: timeDifference,
            reason: !prev.isActive ? 'timer inactive' : 'major desync'
          });
          
          return {
            isActive: true,
            elapsedSeconds: backendElapsed,
            remainingSeconds: data.remainingSeconds || 0,
            isCountdown: data.isCountdown || false,
            currentAmount: data.currentAmount?.toFixed(2) || '0.00',
            currency: data.currency || '₹',
            warnings: data.warnings || []
          };
        } else {
          console.log('🔄 [ASTROLOGER-APP] Local timer running smoothly, ignoring backend sync:', {
            backend: backendElapsed,
            frontend: frontendElapsed,
            difference: timeDifference
          });
          
          // Keep local timer state but update non-timer fields only
          return {
            ...prev,
            remainingSeconds: data.remainingSeconds || prev.remainingSeconds,
            currentAmount: data.currentAmount?.toFixed(2) || prev.currentAmount,
            currency: data.currency || prev.currency,
            warnings: data.warnings || prev.warnings
          };
        }
      });
      
      console.log('🔄 [ASTROLOGER-APP] Timer synchronized with backend:', {
        elapsed: data.elapsedSeconds,
        remaining: data.remainingSeconds,
        amount: data.currentAmount
      });
    } else if (data.type === 'session_started' || data.type === 'user_joined_consultation') {
      console.log('🔄 [ASTROLOGER-APP] Session activation event received:', data.type);
      
      // For user_joined_consultation, verify this is for the current booking
      if (data.type === 'user_joined_consultation') {
        const eventBookingId = data.bookingId;
        const currentBookingId = bookingId || actualFreeChatId;
        
        if (eventBookingId !== currentBookingId) {
          console.log('🔄 [ASTROLOGER-APP] Ignoring user_joined_consultation for different booking:', {
            eventBookingId,
            currentBookingId
          });
          return;
        }
        
        console.log('🔄 [ASTROLOGER-APP] User joined consultation - activating session');
      }
      
      setSessionActive(true);
      setConnectionStatus('session_active');
      
      // Start frontend timer with session data
      if (data.sessionData) {
        console.log('🔄 [ASTROLOGER-APP] Starting frontend timer with session data:', data.sessionData);
        startFrontendTimer(data.sessionData);
      } else {
        console.warn('🔄 [ASTROLOGER-APP] No session data provided for frontend timer');
      }
    } else if (data.type === 'session_resumed') {
      console.log('🔄 [ASTROLOGER-APP] Session resumed event received:', data);
      
      // Update session state with resumed data
      setSessionActive(true);
      setConnectionStatus('session_active');
      
      // Resume or start frontend timer with session data
      if (data.sessionData) {
        console.log('🔄 [ASTROLOGER-APP] Resuming frontend timer with session data:', data.sessionData);
        startFrontendTimer(data.sessionData);
      } else {
        console.warn('🔄 [ASTROLOGER-APP] No session data provided for frontend timer resume');
      }
      
      // Show a toast or alert to inform the astrologer
      Alert.alert(
        'Session Resumed',
        'Your consultation session has been resumed after reconnection.',
        [{ text: 'OK' }]
      );
    } else if (data.type === 'message_history_loaded') {
      console.log(`🔄 [ASTROLOGER-APP] Message history loaded: ${data.count} messages`);
      
      // Auto-scroll to bottom after message history is loaded
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } else if (data.type === 'session_end') {
      console.log('🔴 [ASTROLOGER-APP] Session end received');
      setSessionEnded(true);
      setSessionActive(false);
      
      // Stop frontend timer
      stopFrontendTimer();
      
      // Clear legacy timer ref
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      Alert.alert(
        'Session Ended',
        'The consultation session has ended.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('🔴 [ASTROLOGER-APP] Navigating to Home after session end');
              // Reset navigation to ensure clean state - this will reset all stacks
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                })
              );
            }
          }
        ]
      );
    } else if (data.type === 'user_joined') {
      // User joined the consultation
      console.log('🔴 [ASTROLOGER-APP] User joined consultation');
      setConnectionStatus('user_joined');
    } else if (data.type === 'consultation_ended') {
      console.log('🔴 [ASTROLOGER-APP] Consultation ended event received in handleStatusUpdate');
      console.log('🔴 [ASTROLOGER-APP] Session ended by:', data.endedBy);
      console.log('🔴 [ASTROLOGER-APP] Session data:', data.sessionData);
      
      // Clear session state
      setSessionActive(false);
      setSessionEnded(true);
      setConnectionStatus('session_ended');
      
      // Stop frontend timer
      stopFrontendTimer();
      
      // Clear legacy timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Show alert with session summary and navigate back
      const sessionData = data.sessionData || {};
      const duration = sessionData.duration || 0;
      const totalAmount = sessionData.totalAmount || 0;
      
      Alert.alert(
        'Session Ended',
        `The consultation has been ended by ${data.endedBy}.\n\nDuration: ${duration} minutes\nTotal Amount: ₹${totalAmount}`,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('🔴 [ASTROLOGER-APP] Navigating to Home after session end');
              // Reset navigation to ensure clean state - this will reset all stacks
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                })
              );
            }
          }
        ],
        { cancelable: false }
      );
    }
  }, [navigation, sessionActive]);





  // Request message history after reconnection
  const requestMessageHistory = useCallback(() => {
    if (chatManagerRef.current) {
      console.log('🔄 [ASTROLOGER-APP] Requesting message history after reconnection');
      chatManagerRef.current.requestMessageHistory();
    }
  }, []);
  
  // Send message function
  const sendMessage = useCallback(async () => {
    const messageText = newMessage.trim();
    if (!messageText || !chatManagerRef.current) return;

    console.log('🔴 [ASTROLOGER-APP] Sending message:', messageText);

    // Get astrologer data for sender info
    const astrologerData = await AsyncStorage.getItem('astrologerData');
    const parsedData = astrologerData ? JSON.parse(astrologerData) : null;
    const currentAstrologerId = parsedData?.id || astrologerId;

    // Create temporary message for optimistic UI update
    const tempMessage = {
      id: `temp_${Date.now()}`,
      content: messageText,
      text: messageText,
      message: messageText,
      sender: 'astrologer',
      senderRole: 'astrologer',
      senderId: currentAstrologerId,
      senderName: parsedData?.name || 'Astrologer',
      timestamp: new Date().toISOString(),
      status: 'sending'
    };

    // Add message to UI immediately
    setMessages(prevMessages => [...prevMessages, tempMessage]);
    setNewMessage('');

    // Auto-scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Send message via connection manager
      await chatManagerRef.current.sendMessage({
        roomId: bookingId, // Backend expects roomId parameter
        content: tempMessage.content,
        text: tempMessage.text,
        message: tempMessage.message,
        bookingId: bookingId,
        // CRITICAL FIX: Use actual sessionId from booking data, not bookingId fallback
        sessionId: bookingDetails?.sessionId || sessionId || null, // Use proper sessionId from bookingDetails
        senderId: currentAstrologerId,
        senderName: parsedData?.name || 'Astrologer',
        sender: 'astrologer',
        senderRole: 'astrologer',
        messageId: tempMessage.id,
        timestamp: tempMessage.timestamp
      });

      // Update message status to sent
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, status: 'sent' }
            : msg
        )
      );

      console.log('🔴 [ASTROLOGER-APP] Message sent successfully');
    } catch (error) {
      console.error('🔴 [ASTROLOGER-APP] Failed to send message:', error);
      
      // Update message status to failed
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
    }
  }, [newMessage, astrologerId, bookingId, sessionId]);



  // This duplicate handleEndSession function has been removed
  // The implementation above is now the only one and handles waiting for backend confirmation

  // Format timer display
  const formatTimer = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to format time in MM:SS format
  const formatTime = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) {
      return '00:00';
    }
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get connection status color
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'connecting': case 'reconnecting': return '#FF9800';
      case 'disconnected': case 'error': case 'failed': return '#F44336';
      case 'queued': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  // Get connection status text
  const getConnectionStatusText = () => {
    // If session is active, show session status
    if (sessionActive) {
      return 'In Session';
    }
    
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      case 'failed': return 'Connection Failed';
      case 'queued': return 'Message Queued';
      case 'flushed': return 'Messages Sent';
      case 'session_active': return 'Session Active';
      case 'user_joined': return 'User Joined - Starting Session...';
      default: return 'You joined the consultation';
    }
  };





  // Render message item
  const renderMessage = ({ item }) => {
    console.log('🔴 [ASTROLOGER-APP] ===== RENDERING MESSAGE =====');
    console.log('🔴 [ASTROLOGER-APP] Message ID:', item.id);
    console.log('🔴 [ASTROLOGER-APP] Item content field:', item.content);
    console.log('🔴 [ASTROLOGER-APP] Item text field:', item.text);
    console.log('🔴 [ASTROLOGER-APP] Item message field:', item.message);
    console.log('🔴 [ASTROLOGER-APP] Item sender:', item.sender);
    
    // Defensive check for item existence
    if (!item) {
      console.error('🔴 [ASTROLOGER-APP] Null/undefined message item');
      return null;
    }

    // Check if this message is from the astrologer (current user)
    const isOwnMessage = item.sender === 'astrologer' || item.senderRole === 'astrologer' || item.senderId === astrologerId;
    
    // Enhanced message text extraction with multiple fallbacks and validation
    let messageText = '';
    
    // Try different field combinations with detailed logging
    if (item.content && typeof item.content === 'string' && item.content.trim()) {
      messageText = item.content.trim();
      console.log('🔴 [ASTROLOGER-APP] Using content field for display:', messageText);
    } else if (item.text && typeof item.text === 'string' && item.text.trim()) {
      messageText = item.text.trim();
      console.log('🔴 [ASTROLOGER-APP] Using text field for display:', messageText);
    } else if (item.message && typeof item.message === 'string' && item.message.trim()) {
      messageText = item.message.trim();
      console.log('🔴 [ASTROLOGER-APP] Using message field for display:', messageText);
    } else {
      // No valid message content found - don't render empty bubbles
      console.error('🔴 [ASTROLOGER-APP] NO VALID MESSAGE TEXT FOUND - SKIPPING RENDER:', {
        id: item.id,
        content: item.content,
        contentType: typeof item.content,
        text: item.text,
        textType: typeof item.text,
        message: item.message,
        messageType: typeof item.message,
        allFields: Object.keys(item),
        fullItem: JSON.stringify(item, null, 2)
      });
      return null; // Don't render empty message bubbles
    }
    
    console.log('🔴 [ASTROLOGER-APP] FINAL MESSAGE TEXT FOR DISPLAY:', messageText);
    console.log('🔴 [ASTROLOGER-APP] Message text length:', messageText.length);
    
    // Validate timestamp
    const timestamp = item.timestamp || new Date().toISOString();
    let formattedTime = '';
    try {
      formattedTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('🔴 [ASTROLOGER-APP] Invalid timestamp:', timestamp);
      formattedTime = '--:--';
    }
    
    return (
      <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
            {messageText}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime]}>
            {formattedTime}
          </Text>
        </View>
      </View>
    );
  };

  // Dismiss keyboard when tapping outside
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Timer ref for reducing state updates
  const timerDisplayRef = useRef({ time: '00:00', elapsed: 0 });
  const [timerDisplayState, setTimerDisplayState] = useState({ time: '00:00', elapsed: 0 });

  // Optimized timer display with minimal re-renders
  const timerDisplay = useMemo(() => {
    // Only update if component is fully initialized to prevent flicker during mounting
    if (!initializationCompleteRef.current) {
      return {
        time: '00:00',
        label: 'session',
        billing: '₹0.00'
      };
    }
    
    const elapsedSeconds = timerData.elapsedSeconds || 0;
    const formattedTime = timerDisplayRef.current.time;
    const label = sessionActive && timerData.isActive ? 'elapsed' : 'session';
    const amount = timerData.currentAmount || '0.00';
    const currency = timerData.currency || '₹';
    
    // Reduce logging frequency to minimize performance impact
    const shouldLog = elapsedSeconds % 10 === 0; // Log every 10 seconds instead of every second
    if (shouldLog) {
      console.log('🎨 [TIMER-DISPLAY] Timer display updated (10s interval):', {
        elapsedSeconds,
        formattedTime,
        sessionActive,
        timerIsActive: timerData.isActive
      });
    }
    
    return {
      time: formattedTime,
      label,
      billing: `${currency}${amount}`,
      elapsedSeconds // Track for change detection
    };
  }, [timerData.elapsedSeconds, timerData.isActive, timerData.currentAmount, timerData.currency, sessionActive]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#6B46C1" />
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.innerContainer}>

      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Chat Consultation</Text>
          {userInfo && (
            <View style={styles.userInfoHeader}>
              <Text style={styles.userInfoHeaderText}>
                {userInfo.name} • {userInfo.dateOfBirth ? new Date(userInfo.dateOfBirth).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: '2-digit', 
                  year: 'numeric'
                }) : 'DOB N/A'} • {userInfo.placeOfBirth || 'POB N/A'}
              </Text>
            </View>
          )}
          {/* Timer display */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              {timerDisplay.time}
            </Text>
            <Text style={styles.timerLabel}>
              {timerDisplay.label}
            </Text>
            <Text style={styles.billingText}>
              {timerDisplay.billing}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.endButton}
          onPress={handleManualEndSession}
        >
          <Text style={styles.endButtonText}>End</Text>
        </TouchableOpacity>
      </View>

      {/* Connection Status Banner */}
      {connectionStatus !== 'connected' && (
        <View style={[styles.statusBanner, { backgroundColor: getConnectionStatusColor() }]}>
          <Text style={styles.statusText}>
            {getConnectionStatusText()}
            {connectionMessage ? ` - ${connectionMessage}` : ''}
          </Text>
        </View>
      )}



      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Typing Indicator */}
      {userTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>User is typing...</Text>
        </View>
      )}

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={handleTypingInput}
          placeholder="Type your message..."
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
          editable={!sessionEnded && connectionStatus !== 'failed'}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!newMessage.trim() || sessionEnded || connectionStatus === 'failed') && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sessionEnded || connectionStatus === 'failed'}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6B46C1',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardContainer: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B46C1',
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    paddingBottom: 15,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfoHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
  timerContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 4,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  timerLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textAlign: 'center',
  },
  billingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    marginTop: 2,
  },
  endButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  endButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    marginBottom: 0,
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 20,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: width * 0.75,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  ownBubble: {
    backgroundColor: '#6B46C1',
    borderBottomRightRadius: 5,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 5,
  },
  ownMessageTime: {
    color: '#E0E0E0',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999999',
  },
  typingContainer: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
  },
  typingText: {
    color: '#666666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  sendButton: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfoPanel: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userInfoHeader: {
    backgroundColor: '#6B46C1',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  userInfoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  userInfoContent: {
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  userInfoValue: {
    fontSize: 14,
    color: '#666666',
    flex: 2,
    textAlign: 'right',
  },
});

// 🔧 CRITICAL FIX: Memoize component to prevent external remount triggers
// Enhanced comparison function with comprehensive debugging
const arePropsEqual = (prevProps, nextProps) => {
  console.log('🔍 [MEMO-DEBUG] React.memo comparison called');
  
  // Compare route params that matter for this component
  const prevParams = prevProps.route?.params || {};
  const nextParams = nextProps.route?.params || {};
  
  console.log('🔍 [MEMO-DEBUG] Prev params:', JSON.stringify(prevParams));
  console.log('🔍 [MEMO-DEBUG] Next params:', JSON.stringify(nextParams));
  
  const criticalProps = ['bookingId', 'astrologerId', 'sessionId', 'isFreeChat', 'freeChatId'];
  
  for (const prop of criticalProps) {
    if (prevParams[prop] !== nextParams[prop]) {
      console.log('🚨 [MEMO-DEBUG] Props changed for:', prop, 'prev:', prevParams[prop], 'next:', nextParams[prop]);
      return false; // Props changed, allow re-render
    }
  }
  
  // Compare route key (if it changes, it's a new navigation)
  if (prevProps.route?.key !== nextProps.route?.key) {
    console.log('🚨 [MEMO-DEBUG] Route key changed:', prevProps.route?.key, '->', nextProps.route?.key);
    return false;
  }
  
  // Compare navigation state more thoroughly
  const prevNavState = prevProps.navigation?.getState?.();
  const nextNavState = nextProps.navigation?.getState?.();
  
  if (prevNavState?.index !== nextNavState?.index) {
    console.log('🚨 [MEMO-DEBUG] Navigation index changed:', prevNavState?.index, '->', nextNavState?.index);
    return false;
  }
  
  // For now, let's be very conservative and block ALL re-renders unless critical props change
  console.log('✅ [MEMO-DEBUG] Props are equal, preventing re-render');
  return true; // Props are equal, prevent re-render
};

export default React.memo(EnhancedChatScreen, arePropsEqual);
