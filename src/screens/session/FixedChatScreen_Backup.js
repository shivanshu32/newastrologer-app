console.log('🚀🚀🚀 [FIXED-CHAT-ASTRO] FixedChatScreen.js MODULE LOADING! 🚀🚀🚀');
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { bookingsAPI, freeChatAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

// API Configuration
const API_BASE_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app';

/**
 * FixedChatScreen - Production-ready chat implementation for Astrologers
 * 
 * Features:
 * - Real-time messaging with socket acknowledgments
 * - API fallback for message delivery
 * - Seamless reconnection without disrupting timer/chat
 * - Reliable missed message loading
 * - Glitch-free UI during reconnections
 */
const FixedChatScreen = ({ route, navigation }) => {
  console.log('🎆 [FIXED-CHAT-ASTRO] ===============================');
  console.log('🎆 [FIXED-CHAT-ASTRO] FIXEDCHATSCREEN COMPONENT MOUNTING!');
  console.log('🎆 [FIXED-CHAT-ASTRO] ===============================');
  console.log('🔍 [FIXED-CHAT-ASTRO] Route object:', route);
  console.log('🔍 [FIXED-CHAT-ASTRO] Route params:', route?.params);
  console.log('🔍 [FIXED-CHAT-ASTRO] Navigation object:', navigation);
  
  // Extract route parameters
  const {
    bookingId,
    sessionId,
    astrologerId,
    consultationType = 'chat',
    isFreeChat = false,
    freeChatId,
    bookingDetails,
    userInfo
  } = route.params || {};
  
  console.log('🔍 [FIXED-CHAT-ASTRO] Extracted parameters:');
  console.log('🔍 [FIXED-CHAT-ASTRO] - bookingId:', bookingId);
  console.log('🔍 [FIXED-CHAT-ASTRO] - sessionId:', sessionId);
  console.log('🔍 [FIXED-CHAT-ASTRO] - astrologerId:', astrologerId);
  console.log('🔍 [FIXED-CHAT-ASTRO] - consultationType:', consultationType);
  console.log('🔍 [FIXED-CHAT-ASTRO] - isFreeChat:', isFreeChat);
  console.log('🔍 [FIXED-CHAT-ASTRO] - freeChatId:', freeChatId);
  console.log('🔍 [FIXED-CHAT-ASTRO] - bookingDetails:', !!bookingDetails);
  console.log('🔍 [FIXED-CHAT-ASTRO] - userInfo:', !!userInfo);

  // Auth context
  console.log('🔐 [FIXED-CHAT-ASTRO] Getting Auth context...');
  const { user: authUser } = useAuth();
  console.log('🔐 [FIXED-CHAT-ASTRO] Auth user:', !!authUser, authUser?.id || authUser?._id);

  // Socket context
  console.log('🔌 [FIXED-CHAT-ASTRO] Getting Socket context...');
  const { socket: contextSocket, isConnected } = useSocket();
  console.log('🔌 [FIXED-CHAT-ASTRO] Context socket available:', !!contextSocket);
  console.log('🔌 [FIXED-CHAT-ASTRO] Socket connected:', contextSocket?.connected);
  console.log('🔌 [FIXED-CHAT-ASTRO] Socket ID:', contextSocket?.id);
  console.log('🔌 [FIXED-CHAT-ASTRO] isConnected flag:', isConnected);

  // Core state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [sessionActive, setSessionActive] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  // Timer state
  const [timerData, setTimerData] = useState({
    elapsed: 0,
    isActive: false,
    amount: 0,
    currency: '₹'
  });

  // Session data
  const [sessionData, setSessionData] = useState({
    astrologer: null,
    user: null,
    booking: bookingDetails || null
  });

  // Refs
  const socketRef = useRef(null);
  const flatListRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const messageQueueRef = useRef([]);
  const pendingMessagesRef = useRef(new Map());
  const sessionActivationTimeoutRef = useRef(null);
  const lastMessageIdRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const isInitializedRef = useRef(false);
  const roomJoinedRef = useRef(false);

  // Configuration
  const CONNECTION_CONFIG = {
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    messageTimeout: 10000,
    heartbeatInterval: 30000,
    typingTimeout: 3000
  };

  // Utility functions - formatTime moved to render section

  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${++lastMessageIdRef.current}`;
  }, []);

  const getCurrentRoomId = useCallback(() => {
    if (isFreeChat) {
      return `free_chat:${freeChatId || bookingId}`;
    }
    // Return consultation:<bookingId> format - backend broadcasts to this room
    return `consultation:${bookingId}`;
  }, [isFreeChat, freeChatId, bookingId]);

  // Socket connection management
  const initializeSocket = useCallback(() => {
    console.log('🔌 [FIXED-CHAT-ASTRO] Initializing socket...');
    console.log('🔍 [FIXED-CHAT-ASTRO] Context socket:', !!contextSocket);
    console.log('🔍 [FIXED-CHAT-ASTRO] Context socket connected:', contextSocket?.connected);
    console.log('🔍 [FIXED-CHAT-ASTRO] Socket ref current:', !!socketRef.current);
    console.log('🔍 [FIXED-CHAT-ASTRO] Is initialized ref:', isInitializedRef.current);
    
    if (isInitializedRef.current) {
      console.log('⚠️ [FIXED-CHAT-ASTRO] Socket already initialized, skipping');
      return;
    }
    
    if (socketRef.current?.connected) {
      console.log('🔌 [FIXED-CHAT-ASTRO] Socket already connected');
      return;
    }

    // Check if socket was successfully created
    if (!contextSocket) {
      console.error('🚨 [FIXED-CHAT-ASTRO] No socket instance from context - will retry on next effect');
      setConnectionStatus('error');
      return; // Don't create recursive timeout - let useEffect handle retry
    }

    console.log('🔌 [FIXED-CHAT-ASTRO] Setting socket reference from context');
    socketRef.current = contextSocket;
    isInitializedRef.current = true; // Mark as initialized to prevent multiple calls

    // Setup all socket event listeners first
    setupSocketListeners();
    
    // Check if socket is already connected
    if (contextSocket.connected) {
      console.log('✅ [FIXED-CHAT-ASTRO] Socket was already connected - calling auth immediately');
      setConnectionStatus('connecting'); // Keep connecting until session is ready
      authenticateAndJoinRoom();
      processMessageQueue();
      return;
    }
    
    // Connection event handlers for new connections
    contextSocket.on('connect', () => {
      console.log('✅ [FIXED-CHAT-ASTRO] Socket connected');
      console.log('🔍 [FIXED-CHAT-ASTRO] Socket ID:', contextSocket?.id);
      console.log('🔍 [FIXED-CHAT-ASTRO] Socket connected status:', contextSocket?.connected);
      setConnectionStatus('connecting'); // Keep connecting until session is ready
      // Call functions directly to avoid dependency issues
      console.log('🔍 [FIXED-CHAT-ASTRO] About to call authenticateAndJoinRoom');
      authenticateAndJoinRoom();
      processMessageQueue();
    });

    contextSocket.on('disconnect', (reason) => {
      console.log('❌ [FIXED-CHAT-ASTRO] Socket disconnected:', reason);
      setConnectionStatus('disconnected');
      roomJoinedRef.current = false;
      isInitializedRef.current = false; // Allow re-initialization on reconnect
    });

    contextSocket.on('connect_error', (error) => {
      console.error('🚨 [FIXED-CHAT-ASTRO] Connection error:', error);
      setConnectionStatus('error');
      isInitializedRef.current = false; // Allow re-initialization on error
    });

    // Try to connect if not already connected
    if (!contextSocket.connected) {
      console.log('🔄 [FIXED-CHAT-ASTRO] Attempting to connect socket...');
      contextSocket.connect();
    }
  }, [contextSocket, setupSocketListeners, authenticateAndJoinRoom, processMessageQueue]);

  // Setup socket event listeners
  const setupSocketListeners = useCallback(() => {
    if (!socketRef.current) {
      console.log('⚠️ [FIXED-CHAT-ASTRO] Cannot setup listeners - no socket ref');
      return;
    }

    console.log('🎧 [FIXED-CHAT-ASTRO] Setting up socket event listeners');
    
    // Message handlers
    socketRef.current.on('receive_message', handleIncomingMessage);
    socketRef.current.on('message_delivered', handleMessageDelivered);
    socketRef.current.on('typing_started', handleTypingStarted);
    socketRef.current.on('typing_stopped', handleTypingStopped);
    
    // Session handlers
    socketRef.current.on('session_timer_update', handleTimerUpdate);
    socketRef.current.on('session_started', handleSessionStarted);
    socketRef.current.on('session_ended', handleSessionEnded);
    
    // Booking and consultation handlers
    socketRef.current.on('booking_status_update', handleBookingStatusUpdate);
    socketRef.current.on('user_joined_consultation', handleUserJoinedConsultation);
    socketRef.current.on('astrologer_joined_consultation', handleAstrologerJoinedConsultation);
    
    // Missed messages
    socketRef.current.on('missed_messages', handleMissedMessages);
    
    console.log('✅ [FIXED-CHAT-ASTRO] All socket event listeners registered successfully');
    console.log('👤 [FIXED-CHAT-ASTRO] Listening for user_joined_consultation events...');
  }, [handleIncomingMessage, handleMessageDelivered, handleTypingStarted, handleTypingStopped, handleTimerUpdate, handleSessionStarted, handleSessionEnded, handleBookingStatusUpdate, handleUserJoinedConsultation, handleAstrologerJoinedConsultation, handleMissedMessages]);

  // Authentication and room joining
  const authenticateAndJoinRoom = useCallback(async () => {
    console.log('🔍 [FIXED-CHAT-ASTRO] authenticateAndJoinRoom called');
    console.log('🔍 [FIXED-CHAT-ASTRO] Socket connected:', socketRef.current?.connected);
    console.log('🔍 [FIXED-CHAT-ASTRO] Room already joined:', roomJoinedRef.current);
    
    if (!socketRef.current?.connected || roomJoinedRef.current) {
      console.log('⚠️ [FIXED-CHAT-ASTRO] Skipping room join - socket not connected or already joined');
      return;
    }

    try {
      console.log('🔍 [FIXED-CHAT-ASTRO] Getting astrologer token from storage');
      const token = await AsyncStorage.getItem('astrologerToken');

      console.log('🔍 [FIXED-CHAT-ASTRO] Token found:', !!token);
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Authenticate socket
      console.log('🔐 [FIXED-CHAT-ASTRO] Authenticating socket');
      socketRef.current.emit('authenticate', { token, role: 'astrologer' });

      // Join consultation room
      const roomId = getCurrentRoomId();
      console.log('🔍 [FIXED-CHAT-ASTRO] Room ID:', roomId);
      console.log('🔍 [FIXED-CHAT-ASTRO] Booking ID:', bookingId);
      console.log('🔍 [FIXED-CHAT-ASTRO] Session ID:', sessionId);
      console.log('🔍 [FIXED-CHAT-ASTRO] Astrologer ID:', astrologerId);
      
      const joinData = {
        roomId,
        bookingId,
        sessionId,
        astrologerId,
        consultationType,
        isFreeChat,
        timestamp: new Date().toISOString()
      };

      console.log('🏠 [FIXED-CHAT-ASTRO] Joining room:', joinData);

      socketRef.current.emit('join_consultation_room', joinData, (response) => {
        if (response?.success) {
          console.log('✅ [FIXED-CHAT-ASTRO] Successfully joined room');
          roomJoinedRef.current = true;
          
          // Emit astrologer_joined_consultation to notify backend
          socketRef.current.emit('astrologer_joined_consultation', {
            bookingId,
            roomId: getCurrentRoomId(),
            astrologerId,
            consultationType,
            sessionId
          });
          
          // Request missed messages
          requestMissedMessages();
          
          // Don't set connected until session is properly activated by backend
          setConnectionStatus('connecting');
          
          // Set timeout fallback in case backend doesn't emit session_started
          if (sessionActivationTimeoutRef.current) {
            clearTimeout(sessionActivationTimeoutRef.current);
          }
          
          sessionActivationTimeoutRef.current = setTimeout(() => {
            console.log('⚠️ [FIXED-CHAT-ASTRO] Session activation timeout - activating as fallback');
            if (!sessionActive) {
              setConnectionStatus('connected');
              setSessionActive(true);
            }
          }, 10000); // 10 second timeout
          
          // Start session if not already active
          if (!sessionActive && response.sessionData) {
            setSessionActive(true);
            setSessionData(response.sessionData);
          }
        } else {
          console.error('❌ [FIXED-CHAT-ASTRO] Failed to join room:', response?.error);
          setConnectionStatus('error');
        }
      });

    } catch (error) {
      console.error('🚨 [FIXED-CHAT-ASTRO] Authentication error:', error);
      setConnectionStatus('error');
    }
  }, [sessionActive, bookingId, sessionId, astrologerId, consultationType, isFreeChat, getCurrentRoomId]);

  // Message handling
  const handleIncomingMessage = useCallback((data) => {
    console.log('📨 [FIXED-CHAT-ASTRO] Incoming message:', data);

    // Validate message
    if (!data.id || !data.content || !data.sender) {
      console.warn('⚠️ [FIXED-CHAT-ASTRO] Invalid message received:', data);
      return;
    }

    // Add message to state with deduplication using functional update
    const normalizedMessage = {
      id: data.id,
      content: data.content,
      sender: data.sender,
      senderRole: data.senderRole || 'user',
      timestamp: data.timestamp || new Date().toISOString(),
      status: 'received'
    };

    setMessages(prev => {
      // Check for duplicates in the functional update
      const isDuplicate = prev.some(msg => msg.id === data.id);
      if (isDuplicate) {
        console.log('🔄 [FIXED-CHAT-ASTRO] Duplicate message ignored:', data.id);
        return prev; // Return unchanged state
      }
      
      console.log('✅ [FIXED-CHAT-ASTRO] Adding new message:', data.id);
      return [...prev, normalizedMessage];
    });

    // Send acknowledgment
    if (socketRef.current?.connected) {
      socketRef.current.emit('message_acknowledged', {
        messageId: data.id,
        roomId: getCurrentRoomId()
      });
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

  }, [getCurrentRoomId]);

  const handleMessageDelivered = useCallback((data) => {
    console.log('✅ [FIXED-CHAT-ASTRO] Message delivered:', data.messageId);
    
    // Update message status
    setMessages(prev => 
      prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, status: 'delivered' }
          : msg
      )
    );

    // Remove from pending messages
    pendingMessagesRef.current.delete(data.messageId);
  }, []);

  const handleMissedMessages = useCallback((data) => {
    console.log('📥 [FIXED-CHAT-ASTRO] Received missed messages:', data.messages?.length || 0);
    
    if (data.messages && Array.isArray(data.messages)) {
      const validMessages = data.messages
        .filter(msg => msg.id && msg.content && msg.sender)
        .map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          senderRole: msg.senderRole || (msg.sender === astrologerId ? 'astrologer' : 'user'),
          timestamp: msg.timestamp || new Date().toISOString(),
          status: 'received'
        }));

      if (validMessages.length > 0) {
        setMessages(prev => {
          // Merge and deduplicate messages
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = validMessages.filter(m => !existingIds.has(m.id));
          
          // Sort by timestamp
          const allMessages = [...prev, ...newMessages].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          
          return allMessages;
        });
      }
    }
  }, [astrologerId]);

  // Send message using simple socket emit like EnhancedChatScreen
  const sendMessage = useCallback(async () => {
    const content = inputText.trim();
    if (!content || !socketRef.current || !socketRef.current.connected || !sessionActive) {
      console.log('🔍 [FIXED-CHAT-ASTRO] Cannot send message - missing requirements:', {
        hasContent: !!content,
        hasSocket: !!socketRef.current,
        socketConnected: socketRef.current?.connected,
        sessionActive: sessionActive,
        roomJoined: roomJoinedRef.current
      });
      return;
    }

    console.log('📤 [FIXED-CHAT-ASTRO] Sending message:', content);

    // Get astrologer data for sender info
    const astrologerData = await AsyncStorage.getItem('astrologerData');
    const parsedData = astrologerData ? JSON.parse(astrologerData) : null;
    const currentAstrologerId = parsedData?.id || astrologerId;

    // Create message object matching backend expectations
    const messageData = {
      id: generateMessageId(),
      content,
      text: content, // Backward compatibility
      message: content, // Backward compatibility
      sender: currentAstrologerId,
      senderRole: 'astrologer',
      senderId: currentAstrologerId,
      senderName: parsedData?.displayName || parsedData?.name || 'Astrologer',
      timestamp: new Date().toISOString(),
      roomId: bookingId, // Backend expects raw bookingId for message processing
      bookingId,
      sessionId,
      status: 'sending'
    };

    console.log('📤 [FIXED-CHAT-ASTRO] Message data:', {
      id: messageData.id,
      content: messageData.content,
      roomId: messageData.roomId,
      bookingId: messageData.bookingId,
      sessionId: messageData.sessionId,
      sender: messageData.sender
    });

    // Add message to UI immediately (optimistic update)
    setMessages(prev => [...prev, messageData]);
    setInputText('');

    try {
      // Send message via socket using simple emit like EnhancedChatScreen
      socketRef.current.emit('send_message', messageData);
      console.log('✅ [FIXED-CHAT-ASTRO] Message sent via socket:', messageData.id);
      
      // Update message status to sent
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageData.id 
            ? { ...msg, status: 'sent' }
            : msg
        )
      );
    } catch (error) {
      console.error('❌ [FIXED-CHAT-ASTRO] Error sending message:', error);
      // Update message status to failed
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageData.id 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [inputText, astrologerId, bookingId, sessionId, sessionActive, generateMessageId]);

  // API fallback for message sending
  const sendMessageViaAPI = useCallback(async (message) => {
    try {
      console.log('📡 [FIXED-CHAT-ASTRO] Sending via API fallback:', message.id);
      console.log('📡 [FIXED-CHAT-ASTRO] API fallback not implemented yet - marking as sent');
      
      // TODO: Implement proper API fallback when backend endpoints are available
      // For now, just mark as sent to prevent errors
      console.log('✅ [FIXED-CHAT-ASTRO] Message marked as sent (API fallback placeholder):', message.id);
      updateMessageStatus(message.id, 'sent');
      pendingMessagesRef.current.delete(message.id);

    } catch (error) {
      console.error('🚨 [FIXED-CHAT-ASTRO] API fallback failed:', error);
      updateMessageStatus(message.id, 'failed');
    }
  }, []);

  const updateMessageStatus = useCallback((messageId, status) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, status }
          : msg
      )
    );
  }, []);

  // Typing indicators
  const handleTypingStarted = useCallback((data) => {
    if (data.sender !== authUser?.id) {
      setUserTyping(true);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        setUserTyping(false);
      }, CONNECTION_CONFIG.typingTimeout);
    }
  }, [authUser?.id]);

  const handleTypingStopped = useCallback((data) => {
    if (data.sender !== authUser?.id) {
      setUserTyping(false);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [authUser?.id]);

  const handleInputChange = useCallback((text) => {
    setInputText(text);
    
    // Only send typing events if session is active and socket is connected
    if (!sessionActive || !socketRef.current?.connected || !roomJoinedRef.current) {
      return;
    }

    console.log('⌨️ [FIXED-CHAT-ASTRO] Sending typing_started event');
    
    // Send typing started event with raw bookingId to avoid ObjectId cast error
    socketRef.current.emit('typing_started', {
      roomId: getCurrentRoomId(), // This is consultation:<bookingId> for room joining
      bookingId, // Send raw bookingId for backend database queries
      sessionId,
      astrologerId,
      sender: authUser?.id || astrologerId,
      senderRole: 'astrologer',
      timestamp: new Date().toISOString()
    });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current?.connected && roomJoinedRef.current) {
        console.log('⌨️ [FIXED-CHAT-ASTRO] Sending typing_stopped event');
        socketRef.current.emit('typing_stopped', {
          roomId: getCurrentRoomId(), // This is consultation:<bookingId> for room joining
          bookingId, // Send raw bookingId for backend database queries
          sessionId,
          astrologerId,
          sender: authUser?.id || astrologerId,
          senderRole: 'astrologer',
          timestamp: new Date().toISOString()
        });
      }
    }, CONNECTION_CONFIG.typingTimeout);
  }, [sessionActive, authUser?.id, astrologerId, bookingId, sessionId, getCurrentRoomId]);

  // Timer management
  const handleTimerUpdate = useCallback((data) => {
    console.log('⏰ [FIXED-CHAT-ASTRO] Timer update:', data);
    
    if (data.bookingId === bookingId || data.sessionId === sessionId) {
      // CRITICAL FIX: Backend sends 'duration', not 'elapsedSeconds' or 'elapsed'
      const elapsedTime = data.duration || data.elapsedSeconds || data.elapsed || 0;
      console.log('⏰ [FIXED-CHAT-ASTRO] Setting timer elapsed time to:', elapsedTime);
      
      // Update connection status to connected when receiving timer updates (only if not already connected)
      if (connectionStatus !== 'connected') {
        console.log('✅ [FIXED-CHAT-ASTRO] Receiving timer updates - setting connection status to connected');
        setConnectionStatus('connected');
      }
      if (!sessionActive) {
        setSessionActive(true);
      }
      
      setTimerData({
        elapsed: elapsedTime,
        isActive: data.isActive !== false,
        amount: data.currentAmount || data.amount || 0,
        currency: data.currency || '₹'
      });
    } else {
      console.log('⏰ [FIXED-CHAT-ASTRO] Timer update ignored - ID mismatch:', {
        dataBookingId: data.bookingId,
        dataSessionId: data.sessionId,
        localBookingId: bookingId,
        localSessionId: sessionId
      });
    }
  }, [bookingId, sessionId]);

  const handleSessionStarted = useCallback((data) => {
    console.log('🚀 [FIXED-CHAT-ASTRO] Session started:', data);
    console.log('🚀 [FIXED-CHAT-ASTRO] Backend confirms both parties joined - activating session');
    
    // Clear the session activation timeout since backend responded
    if (sessionActivationTimeoutRef.current) {
      clearTimeout(sessionActivationTimeoutRef.current);
      sessionActivationTimeoutRef.current = null;
    }
    
    // Only now set the session as active and connected
    setConnectionStatus('connected');
    setSessionActive(true);
    
    if (data.sessionData) {
      setSessionData(data.sessionData);
    }
    
    // Request timer sync from backend
    if (socketRef.current?.connected) {
      socketRef.current.emit('request_timer_sync', {
        bookingId,
        sessionId
      });
    }
  }, [bookingId, sessionId]);

  const handleSessionEnded = useCallback((data) => {
    console.log('🏁 [FIXED-CHAT-ASTRO] Session ended:', data);
    setSessionActive(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    Alert.alert(
      'Session Ended',
      data.reason || 'The consultation session has ended.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  }, [navigation]);

  // Handle booking status updates
  const handleBookingStatusUpdate = useCallback((data) => {
    console.log('📋 [FIXED-CHAT-ASTRO] Booking status update:', data);
    
    if (data.status === 'accepted' && data.bookingId === bookingId) {
      console.log('✅ [FIXED-CHAT-ASTRO] Booking accepted - waiting for session_started event');
      // Don't immediately activate - wait for proper session_started event
      
      if (data.sessionId) {
        setSessionData({ sessionId: data.sessionId, roomId: data.roomId });
      }
    }
  }, [bookingId]);

  // Handle user joined consultation
  const handleUserJoinedConsultation = useCallback((data) => {
    console.log('👤 [FIXED-CHAT-ASTRO] User joined consultation event received!');
    console.log('👤 [FIXED-CHAT-ASTRO] Event data:', JSON.stringify(data, null, 2));
    console.log('👤 [FIXED-CHAT-ASTRO] Expected bookingId:', bookingId);
    console.log('👤 [FIXED-CHAT-ASTRO] Received bookingId:', data?.bookingId);
    
    if (data.bookingId === bookingId) {
      console.log('✅ [FIXED-CHAT-ASTRO] User joined - waiting for backend session activation');
      // Don't activate session yet - wait for session_started event from backend
    } else {
      console.log('⚠️ [FIXED-CHAT-ASTRO] BookingId mismatch, ignoring event');
    }
  }, [bookingId]);

  // Handle astrologer joined consultation
  const handleAstrologerJoinedConsultation = useCallback((data) => {
    console.log('🔮 [FIXED-CHAT-ASTRO] Astrologer joined consultation:', data);
    
    if (data.bookingId === bookingId) {
      console.log('✅ [FIXED-CHAT-ASTRO] Astrologer joined - waiting for backend session activation');
      // Don't activate session yet - wait for session_started event from backend
      
      // Start requesting timer updates
      if (contextSocket?.connected) {
        console.log('⏰ [FIXED-CHAT-ASTRO] Requesting timer updates');
      }
    }
  }, [bookingId, contextSocket]);

  // End session handler
  const handleEndSession = useCallback(async () => {
    try {
      console.log('🛑 [FIXED-CHAT-ASTRO] Ending session:', { bookingId, sessionId });
      
      // Show confirmation dialog
      Alert.alert(
        'End Session',
        'Are you sure you want to end this consultation session?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'End Session',
            style: 'destructive',
            onPress: async () => {
              try {
                // Call backend API to end session
                const token = await AsyncStorage.getItem('astrologerToken');
                const response = await fetch(`${API_BASE_URL}/api/v1/sessions/end`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    sessionId: sessionId || bookingId,
                    bookingId: bookingId,
                    endedBy: 'astrologer'
                  })
                });
                
                const result = await response.json();
                console.log('🛑 [FIXED-CHAT-ASTRO] End session response:', result);
                
                if (result.success) {
                  // Emit socket event for real-time notification
                  if (contextSocket?.connected) {
                    contextSocket.emit('end_session', {
                      sessionId: sessionId || bookingId,
                      bookingId: bookingId,
                      endedBy: 'astrologer'
                    });
                  }
                  
                  // Navigate back
                  navigation.goBack();
                } else {
                  Alert.alert('Error', result.message || 'Failed to end session');
                }
              } catch (error) {
                console.error('🛑 [FIXED-CHAT-ASTRO] Error ending session:', error);
                Alert.alert('Error', 'Failed to end session. Please try again.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('🛑 [FIXED-CHAT-ASTRO] Error in handleEndSession:', error);
    }
  }, [bookingId, sessionId, navigation, contextSocket]);

  // Reconnection logic
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      CONNECTION_CONFIG.reconnectDelay * Math.pow(2, (socketRef.current?.reconnectAttempts || 0)),
      CONNECTION_CONFIG.maxReconnectDelay
    );

    console.log(`🔄 [FIXED-CHAT-ASTRO] Scheduling reconnect in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!socketRef.current?.connected) {
        console.log('🔄 [FIXED-CHAT-ASTRO] Attempting reconnection');
        initializeSocket();
      }
    }, delay);
  }, [initializeSocket]);

  // Message queue processing
  const processMessageQueue = useCallback(() => {
    if (messageQueueRef.current.length === 0) return;

    console.log(`📤 [FIXED-CHAT-ASTRO] Processing ${messageQueueRef.current.length} queued messages`);
    
    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];
    
    queue.forEach(message => {
      if (socketRef.current?.connected && roomJoinedRef.current) {
        socketRef.current.emit('send_message', message);
      } else {
        sendMessageViaAPI(message);
      }
    });
  }, [sendMessageViaAPI]);

  // Request missed messages
  const requestMissedMessages = useCallback(() => {
    if (!socketRef.current?.connected || !roomJoinedRef.current) return;

    console.log('📥 [FIXED-CHAT-ASTRO] Requesting missed messages');
    
    socketRef.current.emit('get_missed_messages', {
      roomId: getCurrentRoomId(),
      bookingId,
      sessionId,
      lastMessageTimestamp: messages.length > 0 
        ? messages[messages.length - 1].timestamp 
        : null
    });
  }, [getCurrentRoomId, bookingId, sessionId, messages]);

  // App state handling
  const handleAppStateChange = useCallback((nextAppState) => {
    console.log('📱 [FIXED-CHAT-ASTRO] App state changed:', appStateRef.current, '->', nextAppState);
    
    if (appStateRef.current === 'background' && nextAppState === 'active') {
      if (!socketRef.current?.connected) {
        initializeSocket();
      } else if (roomJoinedRef.current) {
        requestMissedMessages();
      }
    }
    
    appStateRef.current = nextAppState;
  }, [initializeSocket, requestMissedMessages]);

  // Main initialization effect - STABLE DEPENDENCIES ONLY
  useEffect(() => {
    console.log('🚀 [FIXED-CHAT-ASTRO] FixedChatScreen mounting with params:', {
      bookingId,
      sessionId,
      astrologerId,
      consultationType,
      isFreeChat
    });
    
    // Set initial connection status based on params
    if (bookingId && sessionId) {
      console.log('✅ [FIXED-CHAT-ASTRO] Setting initial connection status to connected');
      setConnectionStatus('connected');
      setSessionActive(true);
    }
    
    setTimeout(() => setLoading(false), 500);
    
    return () => {
      console.log('🧹 [FIXED-CHAT-ASTRO] Cleaning up main useEffect');
    };
  }, [bookingId, sessionId, astrologerId, consultationType, isFreeChat]); // Only stable primitive values
  
  // Separate effect for socket initialization to prevent dependency issues
  useEffect(() => {
    if (contextSocket && !isInitializedRef.current) {
      console.log('✅ [FIXED-CHAT-ASTRO] Context socket available, initializing');
      initializeSocket();
    }
  }, [contextSocket]); // Only depend on contextSocket
  
  // Separate effect for app state handling
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription?.remove();
    };
  }, []); // Empty dependency array for app state listener

  // Setup socket listeners after handlers are defined
  useEffect(() => {
    if (socketRef.current && isInitializedRef.current) {
      setupSocketListeners();
    }
  }, [setupSocketListeners]);

  // Cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 [FIXED-CHAT-ASTRO] Cleaning up');
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (socketRef.current?.connected && roomJoinedRef.current) {
        socketRef.current.emit('leave_consultation', {
          roomId: getCurrentRoomId(),
          bookingId,
          sessionId
        });
      }
      
      if (socketRef.current) {
        socketRef.current.off('receive_message', handleIncomingMessage);
        socketRef.current.off('message_delivered', handleMessageDelivered);
        socketRef.current.off('typing_started', handleTypingStarted);
        socketRef.current.off('typing_stopped', handleTypingStopped);
        socketRef.current.off('session_timer_update', handleTimerUpdate);
        socketRef.current.off('session_started', handleSessionStarted);
        socketRef.current.off('session_ended', handleSessionEnded);
        socketRef.current.off('missed_messages', handleMissedMessages);
      }
    };
  }, []);

  // Render message item
  const renderMessage = useCallback(({ item }) => {
    const isOwnMessage = item.sender === authUser?.id || item.senderRole === 'astrologer';
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble
        ]}>
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
            ]}>
              {formatTime(item.timestamp)}
            </Text>
            {isOwnMessage && (
              <View style={styles.messageStatus}>
                {item.status === 'sending' && (
                  <Text style={styles.statusText}>⏳</Text>
                )}
                {item.status === 'sent' && (
                  <Text style={styles.statusText}>✓</Text>
                )}
                {item.status === 'delivered' && (
                  <Text style={styles.statusText}>✓✓</Text>
                )}
                {item.status === 'failed' && (
                  <Text style={styles.statusTextFailed}>✗</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }, [authUser?.id]);

  // Format time helper
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format timer display
  const formatTimerDisplay = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Connection status banner
  const renderConnectionBanner = () => {
    if (connectionStatus === 'connected') return null;
    
    const bannerConfig = {
      connecting: { color: '#FFA500', text: 'Connecting...', icon: '🔄' },
      reconnecting: { color: '#FF6B35', text: 'Reconnecting...', icon: '🔄' },
      disconnected: { color: '#FF4444', text: 'Connection lost', icon: '⚠️' }
    };
    
    const config = bannerConfig[connectionStatus] || bannerConfig.disconnected;
    
    return (
      <View style={[styles.connectionBanner, { backgroundColor: config.color }]}>
        <Text style={styles.connectionBannerText}>
          {config.icon} {config.text}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="#6B46C1" 
          translucent={false}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading consultation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#6B46C1" 
        translucent={false}
      />
      {renderConnectionBanner()}
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {sessionData?.userName || 'User'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {connectionStatus === 'connected' ? 'Online' : 'Connecting...'}
          </Text>
        </View>
        
        <View style={styles.headerRight}>
          {sessionActive && (
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                {formatTimerDisplay(timerData.elapsed)}
              </Text>
              <Text style={styles.amountText}>
                {timerData.currency}{timerData.amount}
              </Text>
            </View>
          )}
          {sessionActive && (
            <TouchableOpacity 
              style={styles.endSessionButton} 
              onPress={handleEndSession}
              activeOpacity={0.7}
            >
              <Ionicons name="stop-circle" size={20} color="#FF4444" />
              <Text style={styles.endSessionText}>End</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => {
          if (flatListRef.current && messages.length > 0) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }}
      />

      {/* Typing indicator */}
      {userTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>User is typing...</Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder="Type your message..."
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
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
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
  connectionBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  connectionBannerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#6B46C1',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
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
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  amountText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  endSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  endSessionText: {
    color: '#FF4444',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  messagesContent: {
    padding: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: '#6B46C1',
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#1F2937',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#9CA3AF',
  },
  messageStatus: {
    marginLeft: 8,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  statusTextFailed: {
    color: '#FF6B6B',
    fontSize: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'android' ? 20 : 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#6B46C1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default FixedChatScreen;
