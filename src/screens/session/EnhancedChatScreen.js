import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import ChatConnectionManager from '../../utils/ChatConnectionManager';

const { width, height } = Dimensions.get('window');

const EnhancedChatScreen = ({ route, navigation }) => {
  console.log('🔴 [ASTROLOGER-APP] ===== ENHANCED CHAT SCREEN COMPONENT MOUNTING =====');
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
  
  console.log('🔴 [ASTROLOGER-APP] Extracted params:');
  console.log('🔴 [ASTROLOGER-APP] - bookingId:', bookingId);
  console.log('🔴 [ASTROLOGER-APP] - astrologerId:', astrologerId);
  console.log('🔴 [ASTROLOGER-APP] - sessionId:', sessionId);
  console.log('🔴 [ASTROLOGER-APP] - routeBookingDetails:', routeBookingDetails);
  console.log('🔴 [ASTROLOGER-APP] - isFreeChat:', isFreeChat);
  console.log('🔴 [ASTROLOGER-APP] - freeChatId:', freeChatId);
  console.log('🔴 [ASTROLOGER-APP] - routeUserInfo:', routeUserInfo);
  
  // Detect free chat session
  const isFreeChatSession = isFreeChat || (routeBookingDetails && routeBookingDetails.isFreeChat);
  const actualFreeChatId = freeChatId || (routeBookingDetails && routeBookingDetails.freeChatId) || (isFreeChatSession ? bookingId : null);
  
  console.log('🔴 [ASTROLOGER-APP] Session type detection:');
  console.log('🔴 [ASTROLOGER-APP] - isFreeChatSession:', isFreeChatSession);
  console.log('🔴 [ASTROLOGER-APP] - actualFreeChatId:', actualFreeChatId);
  
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
  
  // Refs
  const chatManagerRef = useRef(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageIdCounter = useRef(0);
  const timerRef = useRef(null);

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
  }, [routeBookingDetails, fetchBookingDetails]);

  // Initialize chat connection manager
  useEffect(() => {
    const initializeChat = async () => {
      try {
        console.log('🔴 [ASTROLOGER-APP] ===== INITIALIZING CHAT =====');
        console.log('🔴 [ASTROLOGER-APP] BookingId:', bookingId);
        console.log('🔴 [ASTROLOGER-APP] AstrologerId:', astrologerId);
        console.log('🔴 [ASTROLOGER-APP] SessionId:', sessionId);
        
        const astrologerData = await AsyncStorage.getItem('astrologerData');
        const parsedData = astrologerData ? JSON.parse(astrologerData) : null;
        const currentAstrologerId = parsedData?.id || astrologerId;
        
        console.log('🔴 [ASTROLOGER-APP] Current astrologer ID:', currentAstrologerId);
        console.log('🔴 [ASTROLOGER-APP] Parsed astrologer data:', parsedData);

        console.log('🔴 [ASTROLOGER-APP] Creating ChatConnectionManager...');
        chatManagerRef.current = new ChatConnectionManager();
        console.log('🔴 [ASTROLOGER-APP] ChatConnectionManager created successfully');
        
        // Set up event listeners with logging
        console.log('🔴 [ASTROLOGER-APP] Setting up event listeners...');
        const unsubscribeConnection = chatManagerRef.current.onConnectionStatus((status) => {
          console.log('🔴 [ASTROLOGER-APP] Connection status callback triggered:', status);
          handleConnectionStatus(status);
        });
        const unsubscribeMessage = chatManagerRef.current.onMessage((message) => {
          console.log('🔴 [ASTROLOGER-APP] Message callback triggered:', message);
          handleNewMessage(message);
        });
        const unsubscribeTyping = chatManagerRef.current.onTyping((isTyping, data) => {
          console.log('🔴 [ASTROLOGER-APP] Typing callback triggered:', { isTyping, data });
          handleTypingStatus(isTyping, data);
        });
        const unsubscribeStatus = chatManagerRef.current.onStatusUpdate((data) => {
          console.log('🔴 [ASTROLOGER-APP] Status update callback triggered:', data);
          handleStatusUpdate(data);
        });
        console.log('🔴 [ASTROLOGER-APP] Event listeners set up successfully');

        // Initialize connection with free chat support
        console.log('🔴 [ASTROLOGER-APP] Initializing ChatConnectionManager...');
        console.log('🔴 [ASTROLOGER-APP] Session type:', isFreeChatSession ? 'FREE CHAT' : 'REGULAR BOOKING');
        
        const initOptions = {};
        if (isFreeChatSession) {
          initOptions.isFreeChat = true;
          initOptions.freeChatId = actualFreeChatId;
          initOptions.sessionId = sessionId;
          console.log('🔴 [ASTROLOGER-APP] Free chat initialization options:', initOptions);
        }
        
        await chatManagerRef.current.initialize(bookingId, currentAstrologerId, null, initOptions);
        console.log('🔴 [ASTROLOGER-APP] ChatConnectionManager initialized successfully');
        
        // Note: Room joining is handled automatically by ChatConnectionManager.handleConnect()
        console.log('🔴 [ASTROLOGER-APP] Room will be joined automatically when socket connects');

        // Start session timer if sessionId is provided
        if (sessionId) {
          console.log('🔴 [ASTROLOGER-APP] Starting session timer for sessionId:', sessionId);
          chatManagerRef.current.startSessionTimer(sessionId);
        } else {
          console.log('🔴 [ASTROLOGER-APP] No sessionId provided, skipping timer start');
        }

        console.log('🔴 [ASTROLOGER-APP] Chat initialization completed successfully');

        return () => {
          console.log('🔴 [ASTROLOGER-APP] Cleaning up event listeners');
          unsubscribeConnection();
          unsubscribeMessage();
          unsubscribeTyping();
          unsubscribeStatus();
        };
      } catch (error) {
        console.error('🔴 [ASTROLOGER-APP] Failed to initialize chat:', error);
        console.error('🔴 [ASTROLOGER-APP] Error stack:', error.stack);
        Alert.alert('Error', 'Failed to initialize chat connection');
      }
    };

    initializeChat();

    return () => {
      // Note: We don't disconnect the ChatConnectionManager here to maintain
      // socket connection for consecutive bookings. The socket should only
      // disconnect when the astrologer logs out or exits the app completely.
      console.log('🟡 [ASTROLOGER-APP] EnhancedChatScreen cleanup - keeping socket connected for consecutive bookings');
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [bookingId, astrologerId, sessionId]);

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
    }
  }, []);

  // Handle new messages
  const handleNewMessage = useCallback((message) => {
    console.log('🔴 [ASTROLOGER-APP] ===== NEW MESSAGE RECEIVED =====');
    console.log('🔴 [ASTROLOGER-APP] Message ID:', message.id);
    console.log('🔴 [ASTROLOGER-APP] Message content field:', message.content);
    console.log('🔴 [ASTROLOGER-APP] Message text field:', message.text);
    console.log('🔴 [ASTROLOGER-APP] Message message field:', message.message);
    console.log('🔴 [ASTROLOGER-APP] Message sender:', message.sender);
    console.log('🔴 [ASTROLOGER-APP] Full message object:', JSON.stringify(message, null, 2));
    
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
      // Avoid duplicate messages
      const exists = prevMessages.some(msg => msg.id === normalizedMessage.id);
      if (exists) {
        console.log('🔴 [ASTROLOGER-APP] Duplicate message ignored:', normalizedMessage.id);
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

  // Handle status updates (timer, session end, etc.)
  const handleStatusUpdate = useCallback((data) => {
    if (data.type === 'timer') {
      // Use consistent field names with user app - check both durationSeconds and seconds
      const timerValue = data.durationSeconds !== undefined ? data.durationSeconds : data.seconds;
      setSessionTimer(timerValue);
      
      // If we're receiving timer updates but session isn't active, activate it
      if (!sessionActive && timerValue > 0) {
        setSessionActive(true);
        setConnectionStatus('session_active');
      }
    } else if (data.type === 'session_started') {
      setSessionActive(true);
      setConnectionStatus('session_active');
    } else if (data.type === 'session_end') {
      console.log('🔴 [ASTROLOGER-APP] Session end received');
      setSessionEnded(true);
      setSessionActive(false);
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
      
      // Clear timer
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
        sessionId: sessionId || bookingId,
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



  // End session
  const handleEndSession = useCallback(() => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this consultation session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            if (chatManagerRef.current && sessionId) {
              chatManagerRef.current.endSession(sessionId);
            }
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
  }, [sessionId, navigation]);

  // Format timer display
  const formatTimer = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTimer(sessionTimer)}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.endButton}
          onPress={handleEndSession}
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

export default EnhancedChatScreen;
