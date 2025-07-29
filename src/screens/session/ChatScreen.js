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
import { bookingsAPI, sessionsAPI, chatHistoryAPI } from '../../services/api';
import * as socketService from '../../services/socketService';

const ChatScreen = ({ route, navigation }) => {
  const { bookingId, sessionId: routeSessionId, userJoinData } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionId, setSessionId] = useState(routeSessionId || userJoinData?.bookingDetails?.sessionId || null);
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
    console.log('[ASTROLOGER-APP] SessionId state updated:', sessionId);
  }, [sessionId]);

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
        socket.off('consultation_ended');
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

  const fetchChatHistory = async (currentSessionId) => {
    try {
      console.log('🔍 [CHAT] Fetching chat history for sessionId:', currentSessionId);
      
      if (!currentSessionId) {
        console.log('⚠️ [CHAT] No sessionId provided, skipping chat history fetch');
        return;
      }

      const response = await chatHistoryAPI.getChatHistory(currentSessionId);
      const chatHistory = response.data || [];
      
      console.log('✅ [CHAT] Chat history fetched:', chatHistory.length, 'messages');
      
      if (chatHistory.length > 0) {
        // Transform chat history to match the expected message format
        const transformedMessages = chatHistory.map(msg => ({
          id: msg.id || msg._id || Date.now().toString(),
          senderId: msg.senderId || msg.sender_id,
          senderName: msg.senderName || msg.sender_name || (msg.sender === 'astrologer' ? 'Astrologer' : 'User'),
          text: msg.text || msg.message || msg.content,
          timestamp: msg.timestamp || msg.createdAt || msg.created_at,
          status: msg.status || 'sent', // Default status for historical messages
          sender: msg.sender // Keep original sender field for compatibility
        }));
        
        // Sort messages by timestamp (oldest first)
        transformedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        console.log('📝 [CHAT] Setting', transformedMessages.length, 'historical messages');
        setMessages(transformedMessages);
      } else {
        console.log('📝 [CHAT] No chat history found, starting with empty messages');
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ [CHAT] Failed to fetch chat history:', error);
      // Don't show alert for chat history errors, just log and continue
      // The session can still work with empty message history
      setMessages([]);
    }
  };

  const startSession = () => {
    if (socket && isConnected) {
      // Join the room for this booking
      socket.emit('join_room', { bookingId }, async (response) => {
        if (response && response.success) {
          console.log('✅ [CHAT] Successfully joined room for booking:', bookingId);
          
          // Fetch existing chat history first
          const currentSessionId = response.sessionId || sessionId;
          if (currentSessionId) {
            await fetchChatHistory(currentSessionId);
          }
          
          // Set up message listener using socketService
          const cleanupMessageListener = socketService.listenForChatMessages(socket, (message) => {
            if (message.bookingId === bookingId) {
              // IMPORTANT: Always use the original message.id sent by the server
              // This ensures consistency between sender and receiver for read receipts
              if (!message.id) {
                console.error('Received message without ID, this may cause read receipt issues');
              }
              
              const newMessage = {
                id: message.id, // Always use the original ID, no fallback to ensure consistency
                senderId: message.senderId,
                senderName: message.senderName,
                text: message.text,
                timestamp: message.timestamp || new Date().toISOString(),
                status: 'sent' // Initial status is 'sent'
              };
              
              // Add message from user to state
              setMessages(prevMessages => [...prevMessages, newMessage]);
              
              // If the message is from the user, mark it as read
              if (message.senderId !== user?.id) {
                // Mark message as read
                socketService.markMessageAsRead(socket, bookingId, newMessage.id);
              }
            }
          });
          
          // Set up typing indicator listeners
          const cleanupTypingListener = socketService.listenForTypingStatus(
            socket,
            (data) => {
              // Received typing started event
              if (data.bookingId === bookingId) {
                setIsUserTyping(true);
                // Set user typing indicator to true
              }
            },
            (data) => {
              // Received typing stopped event
              if (data.bookingId === bookingId) {
                setIsUserTyping(false);
                // Set user typing indicator to false
              }
            }
          );
          
          // Set up message status update listener
          const cleanupStatusListener = socketService.listenForMessageStatusUpdates(
            socket,
            (data) => {
              // Received message status update
              if (data.bookingId === bookingId) {
                setMessages(prevMessages => {
                  const updatedMessages = prevMessages.map(msg => {
                    if (msg.id === data.messageId) {
                      // Update message status to read
                      return { ...msg, status: 'read' };
                    }
                    return msg;
                  });
                  // Updated messages state
                  return updatedMessages;
                });
                // Updated message status to read
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
          
          // Listen for consultation ended event
          socket.on('consultation_ended', (data) => {
            if (data.bookingId === bookingId) {
              handleConsultationEnded(data);
            }
          });
          
          // Listen for free chat session ended event
          socket.on('free_chat_session_ended', (data) => {
            console.log('[ASTROLOGER-APP] Free chat session ended:', data);
            if (data.sessionId === sessionId || data.freeChatId === bookingId) {
              handleFreeChatSessionEnded(data);
            }
          });
          
          setSessionActive(true);
          setSessionId(response.sessionId);
          
          // Store cleanup function
          messageListenerCleanupRef.current = cleanupMessageListener;
        }
      });
      
      // We'll rely on server timer events instead of local timer
      // The server will emit 'timer' events that we're already listening for
      
      // Notify server that astrologer has joined and session can start
      socket.emit('astrologer_joined', { bookingId });
      
      // Explicitly request timer start with sessionId
      socket.emit('start_session_timer', { bookingId, sessionId });
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
      sender: 'astrologer', // For backward compatibility
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
      // Message sent, update status to sent
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
      // Not sending typing event - session inactive or socket null
      return;
    }
    
    // Send typing_started event
    // Emit typing started event
    socketService.sendTypingStatus(socket, bookingId, true);
    
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set a new timeout to emit typing_stopped after 1 second of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && isConnected) {
        // Emit typing stopped event after timeout
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
        socket.emit('end_session', { sessionId: sessionId, bookingId });
      }
      
      // Call API to end the session directly with the sessionId
      await sessionsAPI.end(sessionId);
      
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

  const handleConsultationEnded = (data) => {
    // Handle consultation ended event
    console.log('Consultation ended:', data);
    setSessionActive(false);
    setSessionEnded(true);
    
    // Clean up any timers
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Show alert to astrologer
    Alert.alert(
      'Consultation Ended',
      `The consultation has ended.\n\nSession Duration: ${data.sessionData?.duration || 0} minutes\nTotal Amount: ₹${data.sessionData?.totalAmount || 0}`,
      [
        {
          text: 'Back to Home',
          onPress: () => {
            navigation.navigate('Home');
          }
        }
      ],
      { cancelable: false }
    );
  };
  
  const handleFreeChatSessionEnded = (data) => {
    // Handle free chat session ended event
    console.log('[ASTROLOGER-APP] Handling free chat session ended:', data);
    
    // Update session state
    setSessionActive(false);
    setSessionEnded(true);
    
    // Clean up any timers
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Calculate duration in minutes
    const durationMinutes = Math.ceil((data.duration || 0) / 60);
    
    // Show alert to astrologer
    Alert.alert(
      'Free Chat Session Ended',
      `The free chat session has ended.\n\nSession Duration: ${durationMinutes} minutes`,
      [
        {
          text: 'Back to Home',
          onPress: () => {
            navigation.navigate('Home');
          }
        }
      ],
      { cancelable: false }
    );
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
    // More reliable check for user messages
    const isUser = item.senderId !== user?.id && item.sender !== 'astrologer';
    
    // Render status indicators for astrologer messages
    const renderStatusIndicator = () => {
      if (isUser) return null; // Only show status for astrologer's messages
      
      // Render message with status
      
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
            {item.content || item.text || item.message || 'Message content unavailable'}
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
        <ActivityIndicator size="large" color="#F97316" />
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
    backgroundColor: '#F97316',
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
    backgroundColor: '#F97316',
    borderBottomRightRadius: 4,
    shadowColor: '#F97316',
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
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#F97316',
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
