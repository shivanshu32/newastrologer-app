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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const ChatScreen = ({ route, navigation }) => {
  const { bookingId } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [booking, setBooking] = useState(null);
  const { user } = useAuth();
  
  const flatListRef = useRef();
  const timerRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchBookingDetails();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (socketRef.current) {
        // In a real app, disconnect from socket
        // socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchBookingDetails = async () => {
    try {
      // In a real app, this would call your backend API
      // const response = await axios.get(`${API_URL}/bookings/${bookingId}`);
      // setBooking(response.data);
      
      // Simulate API call with dummy data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const dummyBooking = {
        id: bookingId,
        userId: '101',
        userName: 'Rahul Sharma',
        userImage: 'https://via.placeholder.com/100',
        type: 'chat',
        status: 'active',
        scheduledTime: new Date().toISOString(),
        duration: 30,
        amount: 500,
        perMinuteRate: 16.67, // 500/30
      };
      
      setBooking(dummyBooking);
      
      // Initialize dummy messages
      const dummyMessages = [
        {
          id: '1',
          senderId: dummyBooking.userId,
          senderName: dummyBooking.userName,
          text: 'Hello, I have some questions about my career path',
          timestamp: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        },
      ];
      
      setMessages(dummyMessages);
      setLoading(false);
      
      // Start session
      startSession();
    } catch (error) {
      console.log('Error fetching booking details:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load chat session. Please try again.');
    }
  };

  const startSession = () => {
    // In a real app, this would connect to a socket
    // socketRef.current = io('YOUR_SOCKET_SERVER_URL');
    // socketRef.current.emit('join-chat', { bookingId, astrologerId: user.id });
    // socketRef.current.on('message', handleNewMessage);
    // socketRef.current.on('session-end', handleSessionEnd);
    
    setSessionActive(true);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
  };

  const handleNewMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !sessionActive) return;
    
    const newMessage = {
      id: Date.now().toString(),
      senderId: user?.id || 'astrologer',
      senderName: user?.name || 'Astrologer',
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
    };
    
    // In a real app, this would emit to socket
    // socketRef.current.emit('message', newMessage);
    
    // Add message to local state
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    // Simulate receiving a response after 2 seconds
    if (messages.length < 5) {
      setTimeout(() => {
        const responseMessages = [
          'I understand your concern. Let me check your birth chart.',
          'Based on your planetary positions, I can see some interesting patterns.',
          'Saturn\'s position indicates potential career growth in the next 6 months.',
          'You might face some challenges initially, but Jupiter\'s influence will help you overcome them.',
        ];
        
        const responseMessage = {
          id: Date.now().toString(),
          senderId: booking.userId,
          senderName: booking.userName,
          text: responseMessages[messages.length - 1],
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, responseMessage]);
      }, 2000);
    }
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

  const endSession = () => {
    // In a real app, this would emit to socket
    // socketRef.current.emit('end-session', { bookingId });
    
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
    const isUser = item.senderId === booking?.userId;
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.astrologerMessageContainer,
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userMessageBubble : styles.astrologerMessageBubble,
        ]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <Text style={styles.messageTime}>{formatMessageTime(item.timestamp)}</Text>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={sessionActive && !sessionEnded}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || !sessionActive) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || !sessionActive}
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
  messagesList: {
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
  },
  userMessageBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  astrologerMessageBubble: {
    backgroundColor: '#8A2BE2',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
  },
  astrologerMessageBubble: {
    backgroundColor: '#8A2BE2',
  },
  userMessageText: {
    color: '#333',
  },
  astrologerMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
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
});

export default ChatScreen;
