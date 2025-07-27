import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const API_BASE_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1';

/**
 * FixedChatScreen - Production-Ready Chat Implementation for Astrologer App
 */
const FixedChatScreen = ({ route, navigation }) => {
  // Mounting guard to prevent duplicate initialization
  const mountingGuardRef = useRef(false);
  const initializationCompleteRef = useRef(false);
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
  
  console.log('🚀 FixedChatScreen (Astrologer): Component mounting with ID:', componentIdRef.current);
  console.log('🚀 FixedChatScreen (Astrologer): Mounting guard status:', mountingGuardRef.current);
  console.log('🚀 FixedChatScreen (Astrologer): Route params:', route.params);
  
  // Track mounting status but don't early return (violates React hooks rules)
  const isDuplicateMount = mountingGuardRef.current;
  if (!isDuplicateMount) {
    mountingGuardRef.current = true;
  } else {
    console.log('⚠️ [MOUNT] Duplicate mount detected for component:', componentIdRef.current);
  }
  
  const { socket } = useSocket();
  const { user: authUser } = useAuth();
  
  // Extract parameters
  const { bookingId, sessionId, userId, consultationType = 'chat', bookingDetails } = route.params || {};
  
  // Refs for stable values
  const socketRef = useRef(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const mountedRef = useRef(true);
  const lastMessageTimestampRef = useRef(0);
  const roomJoinedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const socketInitializedRef = useRef(false);

  // ===== STATE MANAGEMENT =====
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [sessionActive, setSessionActive] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [timerData, setTimerData] = useState({
    elapsed: 0,
    duration: 0,
    isActive: false,
    startTime: null
  });

  // ===== MOUNTING GUARD AND INITIALIZATION =====
  useEffect(() => {
    console.log('🔄 [MOUNT] Component mounted with ID:', componentIdRef.current);
    console.log('🔄 [MOUNT] Initialization complete status:', initializationCompleteRef.current);
    
    // Mark initialization as complete after mount
    initializationCompleteRef.current = true;
    
    return () => {
      console.log('🔄 [UNMOUNT] Component unmounting with ID:', componentIdRef.current);
      mountingGuardRef.current = false;
      initializationCompleteRef.current = false;
    };
  }, []);

  // ===== MAIN COMPONENT INITIALIZATION =====
  useEffect(() => {
    // Skip initialization for duplicate mounts
    if (isDuplicateMount) {
      console.log('⚠️ [INIT] Skipping initialization for duplicate mount:', componentIdRef.current);
      return;
    }
    
    // Prevent duplicate initialization
    if (socketInitializedRef.current) {
      console.log('⚠️ [INIT] Socket already initialized, skipping duplicate initialization:', componentIdRef.current);
      return;
    }
    
    console.log('🚀 [INIT] Starting component initialization for:', componentIdRef.current);
    console.log('🚀 [INIT] BookingId:', bookingId, 'SessionId:', sessionId);
    console.log('🚀 [INIT] AuthUser:', authUser);
    
    if (!bookingId) {
      console.error('❌ [INIT] Missing bookingId:', bookingId);
      return;
    }
    
    if (!authUser?.id) {
      console.error('❌ [INIT] Missing authUser.id, waiting for auth to load...');
      // Don't return here, let it retry when authUser becomes available
      return;
    }
    
    // Mark socket as being initialized
    socketInitializedRef.current = true;
    
    // Initialize socket connection
    const initTimer = setTimeout(() => {
      console.log('🚀 [INIT] Initializing socket after delay');
      initializeSocket();
      
      // Join room after socket initialization
      setTimeout(() => {
        console.log('🚀 [INIT] Joining consultation room');
        joinConsultationRoom();
      }, 1000);
    }, 500);
    
    return () => {
      clearTimeout(initTimer);
      console.log('🚀 [CLEANUP] Component cleanup for:', componentIdRef.current);
      
      // Clean up socket listeners and connection
      if (socketRef.current) {
        console.log('🚀 [CLEANUP] Cleaning up socket listeners');
        socketRef.current.off('receive_message');
        socketRef.current.off('message_delivered');
        socketRef.current.off('typing_indicator');
        socketRef.current.off('session_started');
        socketRef.current.off('session_timer');
        socketRef.current.off('session_ended');
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        
        // Reset socket reference
        socketRef.current = null;
      }
      
      // Reset initialization flags for proper remount handling
      socketInitializedRef.current = false;
      roomJoinedRef.current = false;
      
      // Clear any active timers
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      // Reset room joined status
      roomJoinedRef.current = false;
    };
  }, [bookingId, sessionId, authUser?.id]);

  // ===== UTILITY FUNCTIONS =====
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const getCurrentRoomId = useCallback(() => {
    return `consultation:${bookingId}`;
  }, [bookingId]);

  const safeSetState = useCallback((setter, value) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);

  // ===== TIMER MANAGEMENT =====
  const startLocalTimer = useCallback((duration = 0) => {
    console.log('⏱️ [TIMER] Starting local timer with duration:', duration);
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    const startTime = Date.now();
    safeSetState(setTimerData, {
      elapsed: 0,
      duration,
      isActive: true,
      startTime
    });
    
    timerIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      safeSetState(setTimerData, prev => ({
        ...prev,
        elapsed
      }));
    }, 1000);
  }, [safeSetState]);

  const stopLocalTimer = useCallback(() => {
    console.log('⏱️ [TIMER] Stopping local timer');
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    safeSetState(setTimerData, prev => ({ ...prev, isActive: false }));
  }, [safeSetState]);

  // ===== MESSAGE HANDLING =====
  const handleIncomingMessage = useCallback((messageData) => {
    console.log('📨 [MESSAGE] Received:', messageData);
    console.log('📨 [MESSAGE] Raw messageData keys:', Object.keys(messageData || {}));
    console.log('📨 [MESSAGE] messageData.content:', messageData?.content);
    console.log('📨 [MESSAGE] messageData.senderType:', messageData?.senderType);
    console.log('📨 [MESSAGE] messageData.senderId:', messageData?.senderId);
    
    if (!messageData || !messageData.content) {
      console.warn('⚠️ [MESSAGE] Invalid message data received - messageData:', messageData);
      return;
    }
    
    const messageTime = new Date(messageData.timestamp || Date.now()).getTime();
    if (messageTime <= lastMessageTimestampRef.current) {
      console.log('🔄 [MESSAGE] Duplicate message ignored - messageTime:', messageTime, 'lastTime:', lastMessageTimestampRef.current);
      return;
    }
    lastMessageTimestampRef.current = messageTime;
    
    const newMessage = {
      id: messageData.id || generateMessageId(),
      content: messageData.content,
      senderId: messageData.senderId,
      senderType: messageData.senderType || 'user',
      timestamp: messageData.timestamp || new Date().toISOString(),
      status: 'delivered'
    };
    
    console.log('📨 [MESSAGE] Created newMessage object:', newMessage);
    console.log('📨 [MESSAGE] newMessage.senderType:', newMessage.senderType);
    console.log('📨 [MESSAGE] Will be displayed as:', newMessage.senderType === 'astrologer' ? 'OWN MESSAGE' : 'OTHER MESSAGE');
    
    safeSetState(setMessages, prev => {
      const updatedMessages = [...prev, newMessage];
      console.log('📨 [MESSAGE] Total messages after adding:', updatedMessages.length);
      console.log('📨 [MESSAGE] Last 3 messages:', updatedMessages.slice(-3).map(m => ({
        content: m.content,
        senderType: m.senderType,
        isOwn: m.senderType === 'astrologer'
      })));
      return updatedMessages;
    });
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [generateMessageId, safeSetState]);
  
  const handleMessageDelivered = useCallback((data) => {
    console.log('✅ [MESSAGE] Delivered:', data);
    
    safeSetState(setMessages, prev => 
      prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, status: 'delivered' }
          : msg
      )
    );
  }, [safeSetState]);
  
  const handleTypingIndicator = useCallback((data) => {
    if (data.userId !== authUser?.id) {
      safeSetState(setUserTyping, data.isTyping);
      
      if (data.isTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          safeSetState(setUserTyping, false);
        }, 3000);
      }
    }
  }, [authUser?.id, safeSetState]);
  
  // ===== SESSION EVENT HANDLERS =====
  const handleSessionStarted = useCallback((data) => {
    console.log('🚀 [SESSION] Session started event received:', data);
    console.log('🚀 [SESSION] Current bookingId:', bookingId);
    console.log('🚀 [SESSION] Event bookingId:', data.bookingId);
    console.log('🚀 [SESSION] Setting session active and connected status');
    
    safeSetState(setSessionActive, true);
    safeSetState(setConnectionStatus, 'connected');
    
    if (data.duration) {
      console.log('🚀 [SESSION] Starting timer with duration:', data.duration);
      startLocalTimer(data.duration);
    } else {
      console.log('🚀 [SESSION] No duration provided, starting timer with 0');
      startLocalTimer(0);
    }
  }, [safeSetState, startLocalTimer, bookingId]);
  
  const handleTimerUpdate = useCallback((data) => {
    console.log('⏱️ [TIMER] Update received:', data);
    
    if (data.bookingId !== bookingId) {
      console.log('⚠️ [TIMER] Ignoring timer for different booking');
      return;
    }
    
    safeSetState(setConnectionStatus, 'connected');
    
    if (data.elapsed !== undefined) {
      const backendElapsed = parseInt(data.elapsed, 10);
      const timeDiff = Math.abs(timerData.elapsed - backendElapsed);
      
      if (timeDiff > 5) {
        console.log('⏱️ [TIMER] Syncing with backend timer:', backendElapsed);
        safeSetState(setTimerData, prev => ({
          ...prev,
          elapsed: backendElapsed,
          isActive: true
        }));
      }
    }
  }, [bookingId, safeSetState, timerData.elapsed]);
  
  const handleSessionEnded = useCallback((data) => {
    console.log('🛑 [SESSION] Session ended:', data);
    safeSetState(setSessionActive, false);
    stopLocalTimer();
    
    Alert.alert(
      'Session Ended',
      'Your consultation session has ended.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  }, [safeSetState, stopLocalTimer, navigation]);

  // ===== SOCKET MANAGEMENT =====
  const setupSocketListeners = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    console.log('👂 [SOCKET] Setting up event listeners');
    
    socket.on('connect', () => {
      console.log('✅ [SOCKET] Connected successfully');
      console.log('🔥 [SOCKET] Socket ID:', socket.id);
      safeSetState(setConnectionStatus, 'connecting');
      joinConsultationRoom();
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ [SOCKET] Disconnected:', reason);
      safeSetState(setConnectionStatus, 'connecting');
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ [SOCKET] Connection error:', error);
      safeSetState(setConnectionStatus, 'error');
    });
    
    // Add debug wrapper to ensure event listener is working
    socket.on('receive_message', (data) => {
      console.log('🔥 [SOCKET] receive_message event fired! Data:', data);
      handleIncomingMessage(data);
    });
    socket.on('message_delivered', handleMessageDelivered);
    socket.on('typing_indicator', handleTypingIndicator);
    
    console.log('🎯 [SOCKET] Registering session_started event listener');
    socket.on('session_started', handleSessionStarted);
    
    socket.on('session_timer', handleTimerUpdate);
    socket.on('session_ended', handleSessionEnded);
    
    console.log('🎯 [SOCKET] All event listeners registered successfully');
    console.log('🔥 [SOCKET] receive_message listener registered for socket:', socket.id);
    console.log('🔥 [SOCKET] Current room should be: consultation:' + bookingId);
    
  }, [bookingId]); // Only stable dependencies to prevent remounting
  
  const joinConsultationRoom = useCallback(() => {
    // Try to get socket reference, fallback to context socket if needed
    let currentSocket = socketRef.current;
    if (!currentSocket && socket) {
      console.log('🔄 [ROOM] Socket ref lost, using context socket');
      socketRef.current = socket;
      currentSocket = socket;
    }
    
    if (!currentSocket) {
      console.log('⚠️ [ROOM] No socket available - cannot join room');
      console.log('⚠️ [ROOM] socketRef.current:', !!socketRef.current);
      console.log('⚠️ [ROOM] context socket:', !!socket);
      return;
    }
    
    if (roomJoinedRef.current) {
      console.log('⚠️ [ROOM] Already joined room, skipping');
      return;
    }
    
    const roomId = getCurrentRoomId();
    console.log('🏠 [ROOM] Joining consultation room:', roomId);
    console.log('🏠 [ROOM] BookingId:', bookingId);
    console.log('🏠 [ROOM] SessionId:', sessionId);
    console.log('🏠 [ROOM] AstrologerId:', authUser?.id);
    
    console.log('📤 [EMIT] Emitting join_consultation_room event...');
    currentSocket.emit('join_consultation_room', {
      bookingId,
      sessionId,
      userId: authUser?.id,
      userType: 'astrologer',
      roomId
    });
    console.log('✅ [EMIT] join_consultation_room event emitted successfully');
    
    console.log('📤 [EMIT] Emitting astrologer_joined_consultation event...');
    currentSocket.emit('astrologer_joined_consultation', {
      bookingId,
      sessionId,
      astrologerId: authUser?.id
    });
    console.log('✅ [EMIT] astrologer_joined_consultation event emitted successfully');
    
    roomJoinedRef.current = true;
    console.log('🏠 [ROOM] Room join process completed');
  }, [bookingId, sessionId, authUser?.id]);

  const initializeSocket = useCallback(() => {
    console.log('🔌 [SOCKET] Initializing socket connection for component:', componentIdRef.current);
    console.log('🔌 [SOCKET] Current socketRef.current:', !!socketRef.current);
    console.log('🔌 [SOCKET] Socket from context:', !!socket);
    
    try {
      if (!socket) {
        throw new Error('Socket not available from context');
      }
      
      // Always update socket reference to handle remounts
      socketRef.current = socket;
      console.log('🔌 [SOCKET] Socket reference updated');
      
      if (!socket.connected) {
        console.log('🔌 [SOCKET] Connecting socket...');
        socket.connect();
      }
      
      setupSocketListeners();
      safeSetState(setConnectionStatus, 'connecting');
      
      // Always attempt to join room after socket setup
      setTimeout(() => {
        if (mountedRef.current && socketRef.current) {
          console.log('🏠 [SOCKET] Auto-joining room after socket initialization');
          joinConsultationRoom();
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ [SOCKET] Initialization failed:', error);
      safeSetState(setConnectionStatus, 'error');
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          console.log('🔄 [SOCKET] Attempting reconnection...');
          initializeSocket();
        }
      }, 3000);
    }
  }, []);

  // ===== MESSAGE SENDING =====
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !sessionActive) {
      console.log('⚠️ [MESSAGE] Cannot send - empty text or session inactive');
      return;
    }
    
    const messageContent = inputText.trim();
    const messageId = generateMessageId();
    
    const optimisticMessage = {
      id: messageId,
      content: messageContent,
      senderId: authUser?.id,
      senderType: 'astrologer',
      timestamp: new Date().toISOString(),
      status: 'sending'
    };
    
    safeSetState(setMessages, prev => [...prev, optimisticMessage]);
    safeSetState(setInputText, '');
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    try {
      const socket = socketRef.current;
      if (socket?.connected) {
        console.log('📤 [MESSAGE] Sending via socket:', messageContent);
        
        const messagePayload = {
          id: messageId,
          content: messageContent,
          text: messageContent,
          message: messageContent,
          senderId: authUser?.id,
          senderType: 'astrologer',
          bookingId,
          sessionId,
          roomId: getCurrentRoomId(),
          timestamp: new Date().toISOString()
        };
        
        socket.emit('send_message', messagePayload, (acknowledgment) => {
          if (acknowledgment?.success) {
            console.log('✅ [MESSAGE] Socket send acknowledged');
            safeSetState(setMessages, prev => 
              prev.map(msg => 
                msg.id === messageId 
                  ? { ...msg, status: 'sent' }
                  : msg
              )
            );
          } else {
            console.warn('⚠️ [MESSAGE] Socket send not acknowledged');
            safeSetState(setMessages, prev => 
              prev.map(msg => 
                msg.id === messageId 
                  ? { ...msg, status: 'failed' }
                  : msg
              )
            );
          }
        });
        
      } else {
        console.log('🔄 [MESSAGE] Socket not connected');
        safeSetState(setMessages, prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('❌ [MESSAGE] Send failed:', error);
      safeSetState(setMessages, prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
    }
  }, [inputText, sessionActive, authUser?.id, bookingId, sessionId]);
  
  const handleInputChange = useCallback((text) => {
    safeSetState(setInputText, text);
    
    const socket = socketRef.current;
    if (socket?.connected && sessionActive) {
      socket.emit('typing_indicator', {
        bookingId,
        sessionId,
        userId: authUser?.id,
        isTyping: text.length > 0,
        roomId: getCurrentRoomId()
      });
    }
  }, [sessionActive, bookingId, sessionId, authUser?.id]);
  
  const endSession = useCallback(async () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this consultation session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🛑 [SESSION] Ending session...');
              
              const socket = socketRef.current;
              if (socket?.connected) {
                socket.emit('end_session', {
                  bookingId,
                  sessionId,
                  userId: authUser?.id,
                  endedBy: 'user'
                });
              }
              
              safeSetState(setSessionActive, false);
              stopLocalTimer();
              navigation.goBack();
              
            } catch (error) {
              console.error('❌ [SESSION] End session failed:', error);
              Alert.alert('Error', 'Failed to end session. Please try again.');
            }
          }
        }
      ]
    );
  }, [bookingId, sessionId, authUser?.id]);

  // ===== LIFECYCLE =====
  useEffect(() => {
    console.log('🔄 [LIFECYCLE] Component mounted');
    mountedRef.current = true;
    
    // Reset room joined status on mount to handle remounts
    roomJoinedRef.current = false;
    console.log('🔄 [LIFECYCLE] Reset room joined status for remount');
    
    // Remove duplicate socket initialization - handled by main init useEffect
    
    // Fallback room join after a delay to ensure socket is ready
    const fallbackJoinTimer = setTimeout(() => {
      if (mountedRef.current && !roomJoinedRef.current) {
        console.log('🔄 [LIFECYCLE] Fallback room join attempt');
        joinConsultationRoom();
      }
    }, 1000);
    
    const handleAppStateChange = (nextAppState) => {
      console.log('📱 [APP-STATE] Changed to:', nextAppState);
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔄 [APP-STATE] App foregrounded, reconnecting...');
        if (socketRef.current && !socketRef.current.connected) {
          initializeSocket();
        }
      }
      
      appStateRef.current = nextAppState;
    };
    
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    setTimeout(() => {
      safeSetState(setLoading, false);
    }, 1000);
    
    return () => {
      console.log('🧹 [LIFECYCLE] Component unmounting');
      mountedRef.current = false;
      
      // Clear fallback join timer
      clearTimeout(fallbackJoinTimer);
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (socketRef.current) {
        const events = [
          'connect', 'disconnect', 'connect_error',
          'receive_message', 'message_delivered', 'typing_indicator',
          'session_started', 'session_timer', 'session_ended'
        ];
        
        events.forEach(event => {
          socketRef.current.off(event);
        });
      }
      
      appStateSubscription?.remove();
    };
  }, []);

  // ===== RENDER =====
  const renderMessage = useCallback(({ item }) => {
    const isOwnMessage = item.senderType === 'astrologer';
    
    console.log('🎨 [RENDER] Rendering message:', {
      content: item.content,
      senderType: item.senderType,
      senderId: item.senderId,
      isOwnMessage,
      timestamp: item.timestamp
    });
    
    return (
      <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwnMessage && (
              <View style={styles.messageStatus}>
                {item.status === 'sending' && <Ionicons name="time-outline" size={12} color="#E0E0E0" />}
                {item.status === 'sent' && <Ionicons name="checkmark" size={12} color="#E0E0E0" />}
                {item.status === 'delivered' && <Ionicons name="checkmark-done" size={12} color="#E0E0E0" />}
                {item.status === 'failed' && <Ionicons name="alert-circle" size={12} color="#FF6B6B" />}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }, []);

  // Handle duplicate mount attempts - but still show UI
  if (isDuplicateMount) {
    console.log('🚫 [RENDER] Duplicate mount detected, but showing UI:', componentIdRef.current);
    // Don't return loading screen, continue to show the actual chat UI
    // The mounting guard will prevent duplicate initialization
  }

  // Handle missing auth data
  if (!authUser?.id) {
    console.log('🚫 [RENDER] Waiting for auth data to load...');
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B46C1" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B46C1" />
          <Text style={styles.loadingText}>Connecting to consultation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return { color: '#10B981', text: sessionActive ? 'Connected' : 'Waiting for session to start...' };
      case 'connecting':
        return { color: '#F59E0B', text: 'Connecting...' };
      case 'error':
        return { color: '#EF4444', text: 'Connection lost. Retrying...' };
      default:
        return { color: '#6B7280', text: 'Unknown status' };
    }
  };

  const statusInfo = getStatusInfo();

  // Debug current messages state
  console.log('🔍 [RENDER] Current messages state:', {
    totalMessages: messages.length,
    messages: messages.map(m => ({
      id: m.id,
      content: m.content?.substring(0, 20) + '...',
      senderType: m.senderType,
      isOwn: m.senderType === 'astrologer'
    }))
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#6B46C1" />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {bookingDetails?.user?.name || 'User'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {consultationType === 'chat' ? 'Chat Consultation' : 'Consultation'}
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            {sessionActive && timerData.isActive && (
              <View style={styles.timerContainer}>
                <Text style={styles.timerText}>
                  {formatTime(timerData.elapsed)}
                </Text>
                <Text style={styles.amountText}>
                  ₹{Math.ceil((timerData.elapsed / 60) * (bookingDetails?.rate || 50))}/min
                </Text>
              </View>
            )}
            
            {sessionActive && (
              <TouchableOpacity style={styles.endSessionButton} onPress={endSession}>
                <Ionicons name="stop-circle" size={16} color="#FF4444" />
                <Text style={styles.endSessionText}>End</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={[styles.statusBanner, { backgroundColor: statusInfo.color }]}>
          <Text style={styles.statusText}>{statusInfo.text}</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {userTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>User is typing...</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
            editable={sessionActive && connectionStatus !== 'error'}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || !sessionActive) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || !sessionActive}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6B46C1',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B46C1',
    paddingTop: Platform.OS === 'ios' ? 10 : 25,
    paddingBottom: 15,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  amountText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  endSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  endSessionText: {
    color: '#FF4444',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  statusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
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
    maxWidth: '80%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: '#6B46C1',
    borderBottomRightRadius: 5,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  messageTime: {
    fontSize: 12,
    marginRight: 5,
  },
  ownMessageTime: {
    color: '#E0E0E0',
  },
  otherMessageTime: {
    color: '#999999',
  },
  messageStatus: {
    marginLeft: 5,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
  },
  typingText: {
    color: '#6B7280',
    fontStyle: 'italic',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'android' ? 20 : 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
});

export default FixedChatScreen;
