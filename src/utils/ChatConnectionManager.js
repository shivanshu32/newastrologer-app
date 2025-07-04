import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

/**
 * Enhanced Chat Connection Manager for Astrologer App
 * Handles robust socket connections with reconnection logic, message queuing, and app state management
 */
class ChatConnectionManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectTimer = null;
    this.messageQueue = [];
    this.appState = AppState.currentState;
    this.connectionCallbacks = new Set();
    this.messageCallbacks = new Set();
    this.typingCallbacks = new Set();
    this.statusCallbacks = new Set();
    this.currentBookingId = null;
    this.currentAstrologerId = null;
    this.currentUserId = null;
    
    // Bind methods
    this.handleAppStateChange = this.handleAppStateChange.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleConnectError = this.handleConnectError.bind(this);
    this.handleReconnect = this.handleReconnect.bind(this);
    
    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * Initialize connection with booking details
   */
  async initialize(bookingId, astrologerId, userId = null) {
    console.log('[ChatConnectionManager] Initializing with:', { bookingId, astrologerId, userId });
    
    this.currentBookingId = bookingId;
    this.currentAstrologerId = astrologerId;
    this.currentUserId = userId;
    
    await this.connect();
  }

  /**
   * Connect to socket server
   */
  async connect() {
    if (this.isConnecting || this.isConnected) {
      console.log('[ChatConnectionManager] Already connecting or connected');
      return;
    }

    try {
      this.isConnecting = true;
      this.notifyConnectionStatus('connecting');

      // Get authentication token
      const astrologerToken = await AsyncStorage.getItem('astrologerToken');
      if (!astrologerToken) {
        throw new Error('No authentication token found');
      }

      // Socket configuration
      const socketUrl = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app';
      const socketOptions = {
        query: {
          astrologerId: this.currentAstrologerId,
          bookingId: this.currentBookingId,
          sessionType: 'chat',
        },
        auth: {
          token: astrologerToken,
          id: this.currentAstrologerId,
          role: 'astrologer'
        },
        path: '/ws',
        reconnection: false, // We'll handle reconnection manually
        timeout: 10000,
        transports: ['websocket', 'polling']
      };

      console.log('[ChatConnectionManager] Connecting to:', socketUrl);
      this.socket = io(socketUrl, socketOptions);

      // Set up event listeners
      this.setupEventListeners();

    } catch (error) {
      console.error('[ChatConnectionManager] Connection failed:', error);
      this.isConnecting = false;
      this.notifyConnectionStatus('error', error.message);
      this.scheduleReconnect();
    }
  }

  /**
   * Set up socket event listeners
   */
  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on('connect_error', this.handleConnectError);
    this.socket.on('reconnect', this.handleReconnect);

    // Chat-specific events
    this.socket.on('receive_message', (message) => {
      console.log('🔴 [ASTROLOGER-APP] Received message event:', message);
      console.log('🔴 [ASTROLOGER-APP] Message roomId:', message.roomId);
      console.log('🔴 [ASTROLOGER-APP] Expected roomId:', `room:${this.currentBookingId}`);
      
      // Backend sends roomId as 'room:bookingId', so check both formats
      const expectedRoomId = `room:${this.currentBookingId}`;
      if (message.roomId === expectedRoomId || message.roomId === this.currentBookingId) {
        console.log('🔴 [ASTROLOGER-APP] Message accepted, normalizing fields');
        
        // Extract message content with robust fallback logic
        let messageContent = '';
        if (message.content && typeof message.content === 'string' && message.content.trim()) {
          messageContent = message.content.trim();
        } else if (message.text && typeof message.text === 'string' && message.text.trim()) {
          messageContent = message.text.trim();
        } else if (message.message && typeof message.message === 'string' && message.message.trim()) {
          messageContent = message.message.trim();
        } else {
          console.warn('🔴 [ASTROLOGER-APP] No valid message content found in received message:', message);
          messageContent = '[Message content unavailable]';
        }
        
        // Normalize message fields to ensure compatibility
        const normalizedMessage = {
          ...message,
          id: message.id || message.messageId || `msg_${Date.now()}_${Math.random()}`,
          // Ensure all three content fields are populated with the same validated content
          text: messageContent,
          content: messageContent,
          message: messageContent,
          senderId: message.senderId || message.sender || 'unknown',
          sender: message.sender || message.senderRole || 'unknown',
          senderRole: message.senderRole || message.sender || 'unknown',
          senderName: message.senderName || (message.senderRole === 'user' ? 'User' : 'Astrologer'),
          timestamp: message.timestamp || new Date().toISOString(),
          status: 'received'
        };
        
        console.log('🔴 [ASTROLOGER-APP] Normalized message:', normalizedMessage);
        console.log('🔴 [ASTROLOGER-APP] Final message content:', messageContent);
        this.notifyMessage(normalizedMessage);
      } else {
        console.log('🔴 [ASTROLOGER-APP] Message rejected - roomId mismatch');
      }
    });

    this.socket.on('typing_started', (data) => {
      if (data.bookingId === this.currentBookingId) {
        this.notifyTyping(true, data);
      }
    });

    this.socket.on('typing_stopped', (data) => {
      if (data.bookingId === this.currentBookingId) {
        this.notifyTyping(false, data);
      }
    });

    this.socket.on('message_status_update', (data) => {
      if (data.bookingId === this.currentBookingId) {
        this.notifyStatusUpdate(data);
      }
    });

    this.socket.on('session_status', (data) => {
      console.log('[ChatConnectionManager] Session status:', data);
      this.notifyStatusUpdate(data);
    });

    this.socket.on('session_started', (data) => {
      console.log('🔴 [ASTROLOGER-APP] Session started event received:', data);
      console.log('🔴 [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('🔴 [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      console.log('🔴 [ASTROLOGER-APP] Notifying status update');
      this.notifyStatusUpdate({ type: 'session_started', data });
    });

    this.socket.on('session_timer', (data) => {
      console.log('🔴 [ASTROLOGER-APP] Session timer event received:', data);
      // Backend sends durationSeconds, not seconds
      const timerValue = data.durationSeconds || data.seconds || 0;
      console.log('🔴 [ASTROLOGER-APP] Timer value extracted:', timerValue);
      this.notifyStatusUpdate({ type: 'timer', durationSeconds: timerValue, seconds: timerValue });
    });

    this.socket.on('session_ended', (data) => {
      console.log('[ChatConnectionManager] Session ended:', data);
      this.notifyStatusUpdate({ type: 'session_end', data });
    });

    this.socket.on('consultation_ended', (data) => {
      console.log('🔴 [ASTROLOGER-APP] Consultation ended event received:', data);
      console.log('🔴 [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('🔴 [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      
      if (data.bookingId === this.currentBookingId) {
        console.log('🔴 [ASTROLOGER-APP] Processing consultation end - ended by:', data.endedBy);
        this.notifyConnectionStatus('consultation_ended', `Session ended by ${data.endedBy}`);
        this.notifyStatusUpdate({ 
          type: 'consultation_ended', 
          data,
          endedBy: data.endedBy,
          sessionData: data.sessionData
        });
      } else {
        console.log('🔴 [ASTROLOGER-APP] Consultation ended event ignored - booking ID mismatch');
      }
    });

    // Consultation room events (matching video/voice consultation flow)
    this.socket.on('user_joined_consultation', (data) => {
      console.log('[ChatConnectionManager] User joined consultation:', data);
      if (data.bookingId === this.currentBookingId) {
        this.notifyConnectionStatus('user_joined', 'User joined the consultation');
        this.notifyStatusUpdate({ type: 'user_joined', data });
      }
    });

    this.socket.on('astrologer_joined_consultation', (data) => {
      console.log('[ChatConnectionManager] Astrologer joined consultation:', data);
      if (data.bookingId === this.currentBookingId) {
        this.notifyConnectionStatus('astrologer_joined', 'You joined the consultation');
        this.notifyStatusUpdate({ type: 'astrologer_joined', data });
      }
    });

    // Voice call failure notification - Global handler (works regardless of current screen)
    this.socket.on('call_failure_notification', (data) => {
      console.log(' [ASTROLOGER-APP] Call failure notification received:', data);
      console.log(' [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log(' [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      
      // Show global alert regardless of current screen or booking context
      console.log(' [ASTROLOGER-APP] Showing global call failure alert');
      Alert.alert(
        data.title || 'Call Failed',
        data.message || 'The voice call could not be completed.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log(' [ASTROLOGER-APP] Astrologer acknowledged call failure notification');
            }
          }
        ],
        { cancelable: false }
      );
      
      // Also notify status update if there's an active booking context
      if (data.bookingId === this.currentBookingId) {
        console.log(' [ASTROLOGER-APP] Also sending status update for active booking');
        this.notifyStatusUpdate({ 
          type: 'call_failure', 
          data,
          title: data.title,
          message: data.message,
          failureReason: data.failureReason
        });
      }
    });
  }

  /**
   * Handle successful connection
   */
  handleConnect() {
    console.log('[ChatConnectionManager] Connected successfully');
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000; // Reset delay
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.notifyConnectionStatus('connected');

    // Join room and flush queued messages
    this.joinRoom();
    this.flushMessageQueue();
  }

  /**
   * Handle disconnection
   */
  handleDisconnect(reason) {
    console.log('[ChatConnectionManager] Disconnected:', reason);
    this.isConnected = false;
    this.isConnecting = false;
    this.notifyConnectionStatus('disconnected', reason);

    // Only attempt reconnection for certain disconnect reasons
    if (reason !== 'io client disconnect' && this.appState === 'active') {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle connection error
   */
  handleConnectError(error) {
    console.error('[ChatConnectionManager] Connection error:', error);
    this.isConnecting = false;
    this.notifyConnectionStatus('error', error.message);
    this.scheduleReconnect();
  }

  /**
   * Handle successful reconnection
   */
  handleReconnect() {
    console.log('[ChatConnectionManager] Reconnected successfully');
    this.handleConnect();
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[ChatConnectionManager] Max reconnection attempts reached');
      this.notifyConnectionStatus('failed', 'Maximum reconnection attempts exceeded');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`[ChatConnectionManager] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.notifyConnectionStatus('reconnecting', `Reconnecting in ${Math.ceil(delay / 1000)}s...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Handle app state changes
   */
  handleAppStateChange(nextAppState) {
    console.log('[ChatConnectionManager] App state changed:', this.appState, '->', nextAppState);
    
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
      if (!this.isConnected && !this.isConnecting) {
        console.log('[ChatConnectionManager] App foregrounded, reconnecting...');
        this.connect();
      }
    } else if (nextAppState === 'background') {
      // App went to background - don't disconnect but stop reconnection attempts
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    }
    
    this.appState = nextAppState;
  }

  /**
   * Join chat room
   */
  joinRoom() {
    if (this.isConnected && this.socket && this.currentBookingId) {
      console.log('[ChatConnectionManager] Joining consultation room:', this.currentBookingId);
      
      // Construct roomId in the format expected by backend
      const roomId = `room:${this.currentBookingId}`;
      
      // Use the same join_consultation_room event as video/voice consultations
      this.socket.emit('join_consultation_room', {
        bookingId: this.currentBookingId,
        roomId: roomId,
        sessionId: this.currentBookingId, // Use bookingId as sessionId for chat
        astrologerId: this.currentAstrologerId,
        userType: 'astrologer',
        consultationType: 'chat'
      });
      
      this.notifyConnectionStatus('joining', 'Joining consultation room...');
    } else {
      console.warn('[ChatConnectionManager] Cannot join room - not connected or missing booking ID');
    }
  }

  /**
   * Send message with queuing support
   */
  sendMessage(messageData) {
    if (this.isConnected && this.socket) {
      this.socket.emit('send_message', messageData);
      console.log('[ChatConnectionManager] Message sent:', messageData.id);
    } else {
      // Queue message for later sending
      this.messageQueue.push(messageData);
      console.log('[ChatConnectionManager] Message queued:', messageData.id);
      this.notifyConnectionStatus('queued', 'Message queued - will send when reconnected');
    }
  }

  /**
   * Send typing status
   */
  sendTypingStatus(isTyping) {
    if (this.isConnected && this.socket) {
      this.socket.emit(isTyping ? 'typing_started' : 'typing_stopped', {
        bookingId: this.currentBookingId,
        astrologerId: this.currentAstrologerId
      });
      console.log(`[ChatConnectionManager] Sent ${isTyping ? 'typing_started' : 'typing_stopped'} event for booking ${this.currentBookingId}`);
    }
  }

  /**
   * Emit typing status (alias for sendTypingStatus for compatibility)
   */
  emitTyping(isTyping) {
    this.sendTypingStatus(isTyping);
  }

  /**
   * Mark message as read
   */
  markMessageAsRead(messageId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('message_read', {
        bookingId: this.currentBookingId,
        messageId
      });
    }
  }

  /**
   * Start session timer
   */
  startSessionTimer(sessionId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('start_session_timer', {
        bookingId: this.currentBookingId,
        sessionId
      });
    }
  }

  /**
   * End session
   */
  endSession(sessionId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('end_session', {
        bookingId: this.currentBookingId,
        sessionId
      });
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    if (this.messageQueue.length > 0 && this.isConnected && this.socket) {
      console.log(`[ChatConnectionManager] Flushing ${this.messageQueue.length} queued messages`);
      
      this.messageQueue.forEach(messageData => {
        this.socket.emit('send_message', messageData);
      });
      
      this.messageQueue = [];
      this.notifyConnectionStatus('flushed', 'Queued messages sent');
    }
  }

  /**
   * Add connection status callback
   */
  onConnectionStatus(callback) {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  /**
   * Add message callback
   */
  onMessage(callback) {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Add typing callback
   */
  onTyping(callback) {
    this.typingCallbacks.add(callback);
    return () => this.typingCallbacks.delete(callback);
  }

  /**
   * Add status update callback
   */
  onStatusUpdate(callback) {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * Notify connection status
   */
  notifyConnectionStatus(status, message = '') {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback({ status, message, isConnected: this.isConnected, isConnecting: this.isConnecting });
      } catch (error) {
        console.error('[ChatConnectionManager] Error in connection callback:', error);
      }
    });
  }

  /**
   * Notify new message
   */
  notifyMessage(message) {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('[ChatConnectionManager] Error in message callback:', error);
      }
    });
  }

  /**
   * Notify typing status
   */
  notifyTyping(isTyping, data) {
    this.typingCallbacks.forEach(callback => {
      try {
        callback(isTyping, data);
      } catch (error) {
        console.error('[ChatConnectionManager] Error in typing callback:', error);
      }
    });
  }

  /**
   * Notify status update
   */
  notifyStatusUpdate(data) {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[ChatConnectionManager] Error in status callback:', error);
      }
    });
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    console.log('[ChatConnectionManager] Disconnecting...');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Clear all callbacks
    this.connectionCallbacks.clear();
    this.messageCallbacks.clear();
    this.typingCallbacks.clear();
    this.statusCallbacks.clear();

    this.notifyConnectionStatus('disconnected', 'Manually disconnected');
  }

  /**
   * Get current connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      appState: this.appState
    };
  }
}

export default ChatConnectionManager;
