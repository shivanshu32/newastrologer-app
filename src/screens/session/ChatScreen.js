import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { bookingsAPI, sessionsAPI } from '../../services/api';
import * as socketService from '../../services/socketService';

const ChatScreen = ({ route, navigation }) => {
  const { bookingId } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [booking, setBooking] = useState(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const flatListRef = useRef();
  const timerRef = useRef(null);
  const messageListenerCleanupRef = useRef(null);

  useEffect(() => {
    fetchBookingDetails();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Clean up socket listeners
      if (socket) {
        // Clean up message listener using the stored cleanup function
        if (messageListenerCleanupRef.current) {
          messageListenerCleanupRef.current();
        }
        
        socket.off('timer');
        socket.off('session_end');
      }
    };
  }, [socket]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch booking details from API
      const response = await bookingsAPI.getById(bookingId);
      const bookingData = response.data.data;
      
      setBooking(bookingData);
      setLoading(false);
      
      // Start session
      startSession();
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to load chat session. Please try again.');
    }
  };

  const startSession = () => {
    if (socket && isConnected) {
      // Join the room for this booking
      socket.emit('join_room', { bookingId }, (response) => {
        if (response && response.success) {
          // Set up message listener using socketService
          const cleanupMessageListener = socketService.listenForChatMessages(socket, (message) => {
            if (message.bookingId === bookingId) {
              const newMessage = {
                id: message.id || Date.now().toString(),
                senderId: message.senderId,
                senderName: message.senderName,
                text: message.text,
                timestamp: message.timestamp || new Date().toISOString(),
                status: 'sent' // Initial status is 'sent'
              };
              
              setMessages(prevMessages => [...prevMessages, newMessage]);
              
              // If the message is from the user, mark it as read
              if (message.senderId !== user?.id) {
                socketService.markMessageAsRead(socket, bookingId, newMessage.id);
              }
            }
          });
          
          // Set up typing indicator listeners
          const cleanupTypingListener = socketService.listenForTypingStatus(
            socket,
            (data) => {
              console.log('[ASTROLOGER-APP] Received typing_started event:', data);
              if (data.bookingId === bookingId) {
                setIsUserTyping(true);
                console.log('[ASTROLOGER-APP] Set isUserTyping to true');
              }
            },
            (data) => {
              console.log('[ASTROLOGER-APP] Received typing_stopped event:', data);
              if (data.bookingId === bookingId) {
                setIsUserTyping(false);
                console.log('[ASTROLOGER-APP] Set isUserTyping to false');
              }
            }
          );
          
          // Set up message status update listener
          const cleanupStatusListener = socketService.listenForMessageStatusUpdates(
            socket,
            (data) => {
              console.log('[ASTROLOGER-APP] Received message_status_update:', data);
              if (data.bookingId === bookingId) {
                setMessages(prevMessages => {
                  const updatedMessages = prevMessages.map(msg => 
                    msg.id === data.messageId ? { ...msg, status: 'read' } : msg
                  );
                  console.log('[ASTROLOGER-APP] Updated message status to read for message:', data.messageId);
                  return updatedMessages;
                });
              }
            }
          );
          
          // Store all cleanup functions
          messageListenerCleanupRef.current = () => {
            cleanupMessageListener();
            cleanupTypingListener();
            cleanupStatusListener();
          };
          
          // Listen for session timer updates
          socket.on('session_timer', (data) => {
            // The server sends { sessionId, durationSeconds, durationMinutes, currentAmount, currency }
            setSessionTime(data.durationSeconds);
          });
          
          // Keep the old listener for backward compatibility
          socket.on('timer', (data) => {
            if (data.bookingId === bookingId) {
              setSessionTime(data.seconds);
            }
          });
          
          // Listen for session end event
          socket.on('session_end', (data) => {
            if (data.bookingId === bookingId) {
              handleSessionEnd(data);
            }
          });
          
          setSessionActive(true);
          
          // Store cleanup function
          messageListenerCleanupRef.current = cleanupMessageListener;
        }
      });
      
      // We'll rely on server timer events instead of local timer
      // The server will emit 'timer' events that we're already listening for
      
      // Notify server that astrologer has joined and session can start
      socket.emit('astrologer_joined', { bookingId });
      
      // Explicitly request timer start
      socket.emit('start_session_timer', { bookingId });
    }
  };

  const handleNewMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !sessionActive) return;
    
    // Capture the trimmed input text before clearing it
    const messageText = inputText.trim();
    
    const messageId = Date.now().toString();
    const newMessage = {
      id: messageId,
      senderId: user?.id || 'astrologer',
      senderName: user?.name || 'Astrologer',
      text: messageText,
      timestamp: new Date().toISOString(),
      status: 'sending' // Initial status is 'sending'
    };
    
    try {
      // Clear input immediately for better UX
      setInputText('');
      
      // Send typing_stopped event when sending a message
      socketService.sendTypingStatus(socket, bookingId, false);
      
      // Add message to local state
      setMessages(prev => [...prev, newMessage]);
      
      // Send message via socketService with messageId
      await socketService.sendChatMessage(
        socket,
        bookingId,
        messageText,
        user?.id,
        user?.name || 'Astrologer',
        messageId // Pass the messageId to track read receipts
      );
      
      // Update message status to 'sent'
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId ? { ...msg, status: 'sent' } : msg
        )
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };
  
  // Handle text input changes with typing indicator
  const handleTextInputChange = (text) => {
    setInputText(text);
    
    // Only emit typing events if the session is active
    if (!sessionActive || !socket) {
      console.log('[ASTROLOGER-APP] Not sending typing event - session inactive or socket null');
      return;
    }
    
    // Send typing_started event
    console.log('[ASTROLOGER-APP] Emitting typing_started event for bookingId:', bookingId);
    socketService.sendTypingStatus(socket, bookingId, true);
    
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set a new timeout to emit typing_stopped after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && isConnected) {
        console.log('[ASTROLOGER-APP] Emitting typing_stopped event after timeout for bookingId:', bookingId);
        socketService.sendTypingStatus(socket, bookingId, false);
      }
    }, 1000);
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this consultation session?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: endSession,
        },
      ]
    );
  };

  const endSession = async () => {
    try {
      // Emit end_session event to socket
      if (socket && isConnected) {
        socket.emit('end_session', { bookingId });
      }
      
      // Call API to end the session directly with the bookingId
      await sessionsAPI.end(bookingId);
      
      // Clean up any timers
      if (timerRef.current) clearInterval(timerRef.current);
      setSessionActive(false);
      setSessionEnded(true);
      
      // Calculate charges
      const minutes = Math.ceil(sessionTime / 60);
      const charges = minutes * (booking?.perMinuteRate || 0);
      
      // Navigate to rating screen
      navigation.replace('Rating', {
        bookingId,
        sessionDuration: minutes,
        charges,
      });
    } catch (error) {
      console.error('Error ending session:', error);
      Alert.alert('Error', 'Failed to end session. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = ({ item }) => {
    // Check if the message is from the user (not from the astrologer)
    const isUser = item.senderId !== user?.id;
    
    // Render status indicators for astrologer messages
    const renderStatusIndicator = () => {
      if (isUser) return null; // Only show status for astrologer's messages
      
      switch (item.status) {
        case 'sending':
          return <Ionicons name="time-outline" size={12} color="#888" style={styles.statusIcon} />;
        case 'sent':
          return <Ionicons name="checkmark-outline" size={12} color="#888" style={styles.statusIcon} />;
        case 'read':
          return (
            <View style={styles.doubleTickContainer}>
              <Ionicons name="checkmark-outline" size={12} color="#4CAF50" style={styles.statusIcon} />
              <Ionicons name="checkmark-outline" size={12} color="#4CAF50" style={[styles.statusIcon, styles.secondTick]} />
            </View>
          );
        default:
          return <Ionicons name="checkmark-outline" size={12} color="#888" style={styles.statusIcon} />;
      }
    };
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.astrologerMessageContainer,
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userMessageBubble : styles.astrologerMessageBubble,
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.astrologerMessageText
          ]}>
            {item.text}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{formatMessageTime(item.timestamp)}</Text>
            {renderStatusIndicator()}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <Text style={styles.loadingText}>Loading chat session...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
        contentContainerStyle={{ flex: 1 }}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (sessionActive) {
                  handleEndSession();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{booking?.userName}</Text>
              <Text style={styles.sessionType}>Chat Consultation</Text>
            </View>
            
            <View style={styles.timerContainer}>
              <Ionicons name="time-outline" size={16} color="#fff" />
              <Text style={styles.timerText}>{formatTime(sessionTime)}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        </View>
        
        {/* Typing indicator */}
        {isUserTyping && (
          <View style={styles.typingIndicatorContainer}>
            <Text style={styles.typingIndicatorText}>User is typing...</Text>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={handleTextInputChange}
            multiline
            maxLength={500}
            editable={sessionActive && !sessionEnded}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || !sessionActive || sessionEnded) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || !sessionActive || sessionEnded}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {sessionActive && (
          <TouchableOpacity
            style={styles.endSessionButton}
            onPress={handleEndSession}
          >
            <Text style={styles.endSessionButtonText}>End Session</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  chatContainer: {
    flex: 1,
    paddingBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#8A2BE2',
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  sessionType: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  timerText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  messageList: {
    padding: 15,
    paddingBottom: 70,
  },
  messageContainer: {
    marginBottom: 15,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-start',
  },
  astrologerMessageContainer: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    minWidth: 80,
  },
  userMessageBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  astrologerMessageBubble: {
    backgroundColor: '#8A2BE2',
    borderBottomRightRadius: 4,
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#333',
  },
  astrologerMessageText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  messageTime: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    marginRight: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  statusIcon: {
    marginLeft: 2,
  },
  doubleTickContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondTick: {
    marginLeft: -5,
  },
  typingIndicatorContainer: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: '70%',
  },
  typingIndicatorText: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: 12,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    minHeight: 60,
    paddingBottom: Platform.OS === 'android' ? 15 : 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  endSessionButton: {
    position: 'absolute',
    top: 100,
    right: 15,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  endSessionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  endSessionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default ChatScreen;
