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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatConnectionManager from '../../utils/ChatConnectionManager';

const { width, height } = Dimensions.get('window');

const EnhancedChatScreen = ({ route, navigation }) => {
  const { bookingId, astrologerId, sessionId } = route.params;
  
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
  
  // Refs
  const chatManagerRef = useRef(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageIdCounter = useRef(0);
  const timerRef = useRef(null);

  // Initialize chat connection manager
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const astrologerData = await AsyncStorage.getItem('astrologerData');
        const parsedData = astrologerData ? JSON.parse(astrologerData) : null;
        const currentAstrologerId = parsedData?.id || astrologerId;

        chatManagerRef.current = new ChatConnectionManager();
        
        // Set up event listeners
        const unsubscribeConnection = chatManagerRef.current.onConnectionStatus(handleConnectionStatus);
        const unsubscribeMessage = chatManagerRef.current.onMessage(handleNewMessage);
        const unsubscribeTyping = chatManagerRef.current.onTyping(handleTypingStatus);
        const unsubscribeStatus = chatManagerRef.current.onStatusUpdate(handleStatusUpdate);

        // Initialize connection
        await chatManagerRef.current.initialize(bookingId, currentAstrologerId);

        // Start session timer if sessionId is provided
        if (sessionId) {
          chatManagerRef.current.startSessionTimer(sessionId);
        }

        return () => {
          unsubscribeConnection();
          unsubscribeMessage();
          unsubscribeTyping();
          unsubscribeStatus();
        };
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        Alert.alert('Error', 'Failed to initialize chat connection');
      }
    };

    initializeChat();

    return () => {
      if (chatManagerRef.current) {
        chatManagerRef.current.disconnect();
      }
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
    setConnectionStatus(status.status);
    setConnectionMessage(status.message || '');
    
    if (status.status === 'connected') {
      console.log('Chat connected successfully');
    } else if (status.status === 'error' || status.status === 'failed') {
      console.error('Chat connection error:', status.message);
    }
  }, []);

  // Handle new messages
  const handleNewMessage = useCallback((message) => {
    console.log('🔴 [ASTROLOGER-APP] Message received:', message.id);
    
    setMessages(prevMessages => {
      // Avoid duplicate messages
      const exists = prevMessages.some(msg => msg.id === message.id);
      if (exists) {
        return prevMessages;
      }
      
      // Add message without sorting to prevent blocking
      const newMessages = [...prevMessages, message];
      
      // Auto-scroll to bottom immediately for instant message display
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 0);
      
      return newMessages;
    });

    // Mark message as read if it's from user (non-blocking)
    if (message.senderId !== astrologerId && chatManagerRef.current) {
      setTimeout(() => {
        chatManagerRef.current.markMessageAsRead(message.id);
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
            onPress: () => navigation.goBack()
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
      const astrologerEarning = sessionData.astrologerEarning || 0;
      const totalAmount = sessionData.totalAmount || 0;
      
      Alert.alert(
        'Session Ended',
        `The consultation has been ended by ${data.endedBy}.\n\nDuration: ${duration} minutes\nYour Earnings: ₹${astrologerEarning}`,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('🔴 [ASTROLOGER-APP] Resetting navigation to Home after session end');
              // Reset navigation stack to prevent returning to WaitingRoom
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
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
            navigation.goBack();
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

    console.log("in render message")

    console.log(item)

    console.log("above is item")


    // Check if this message is from the astrologer (current user)
    const isOwnMessage = item.sender === 'astrologer' || item.senderRole === 'astrologer' || item.senderId === astrologerId;
    const messageText = item.content || item.text || item.message || 'Message content unavailable';

    console.log("message text is")
    console.log(messageText)
    
    console.log('🔴 [ASTROLOGER-APP] Rendering message:', {
      id: item.id,
      sender: item.sender,
      senderRole: item.senderRole,
      senderId: item.senderId,
      astrologerId: astrologerId,
      isOwnMessage: isOwnMessage,
      content: item.content,
      text: item.text,
      message: item.message,
      messageText: messageText,
      timestamp: item.timestamp
    });
    
    return (
      <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>
            {messageText}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
  );
};

const styles = StyleSheet.create({
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
});

export default EnhancedChatScreen;
