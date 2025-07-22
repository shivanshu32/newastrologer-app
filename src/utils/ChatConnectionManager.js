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
    // Free chat support
    this.isFreeChat = false;
    this.freeChatId = null;
    this.sessionId = null;
    this.sessionStartTime = null;
    this.sessionDuration = 180; // Default 3 minutes for free chat
    
    // 🔄 Enhanced session state management for production reliability
    this.persistentSocketId = `astrologer_socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionState = {
      isActive: false,
      sessionId: null,
      bookingId: null,
      astrologerId: null,
      userId: null,
      lastTimerUpdate: null,
      isFreeChat: false,
      freeChatId: null
    };
    this.reconnectionInProgress = false;
    
    console.log('🆔 [ASTROLOGER-APP] Generated persistent socket ID:', this.persistentSocketId);
    
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
   * Handle app state changes to maintain timer continuity
   */
  handleAppStateChange(nextAppState) {
    console.log('[ChatConnectionManager] App state changed:', this.appState, '->', nextAppState);
    
    const previousAppState = this.appState;
    this.appState = nextAppState;
    
    if (previousAppState === 'background' && nextAppState === 'active') {
      console.log('[ChatConnectionManager] App returned to foreground - checking session state');
      this.handleAppForeground();
    } else if (nextAppState === 'background') {
      console.log('[ChatConnectionManager] App went to background - preserving session state');
      this.handleAppBackground();
    }
  }

  /**
   * Handle app coming to foreground
   */
  async handleAppForeground() {
    try {
      console.log('[ChatConnectionManager] Handling app foreground transition');
      
      // Check if we have an active session
      if (this.currentBookingId && this.isConnected) {
        console.log('[ChatConnectionManager] Active session detected, requesting timer sync');
        
        // Request current session state from backend
        if (this.socket && this.socket.connected) {
          this.socket.emit('request_session_state', {
            bookingId: this.currentBookingId,
            sessionId: this.sessionId,
            isFreeChat: this.isFreeChat,
            freeChatId: this.freeChatId
          });
        }
        
        // Rejoin room if needed
        await this.rejoinRoomIfNeeded();
      }
    } catch (error) {
      console.error('[ChatConnectionManager] Error handling app foreground:', error);
    }
  }

  /**
   * Handle app going to background
   */
  handleAppBackground() {
    console.log('[ChatConnectionManager] Handling app background transition');
    
    // Store current session state
    if (this.currentBookingId) {
      this.preservedState = {
        bookingId: this.currentBookingId,
        sessionId: this.sessionId,
        astrologerId: this.currentAstrologerId,
        userId: this.currentUserId,
        isFreeChat: this.isFreeChat,
        freeChatId: this.freeChatId,
        timestamp: Date.now()
      };
      console.log('[ChatConnectionManager] Session state preserved for background');
    }
  }

  /**
   * Rejoin room if connection was lost
   */
  async rejoinRoomIfNeeded() {
    try {
      if (!this.socket || !this.socket.connected) {
        console.log('[ChatConnectionManager] Socket not connected, cannot rejoin room');
        return;
      }
      
      console.log('[ChatConnectionManager] Checking if room rejoin is needed');
      
      if (this.isFreeChat && this.freeChatId) {
        console.log('[ChatConnectionManager] Rejoining free chat room:', this.freeChatId);
        this.socket.emit('join_free_chat_room', {
          freeChatId: this.freeChatId,
          sessionId: this.sessionId,
          userId: this.currentUserId || this.currentAstrologerId,
          userType: 'astrologer'
        });
      } else if (this.currentBookingId) {
        console.log('[ChatConnectionManager] Rejoining consultation room:', this.currentBookingId);
        this.socket.emit('join_consultation_room', {
          bookingId: this.currentBookingId,
          astrologerId: this.currentAstrologerId,
          userId: this.currentUserId
        });
      }
    } catch (error) {
      console.error('[ChatConnectionManager] Error rejoining room:', error);
    }
  }

  /**
   * Comprehensive session restoration after reconnection
   */
  async restoreSessionAfterReconnect() {
    try {
      console.log('🔄 [ASTROLOGER-APP] Starting session restoration after reconnect');
      console.log('🔄 [ASTROLOGER-APP] Current session state:', this.sessionState);
      
      if (!this.socket || !this.socket.connected) {
        console.log('❌ [ASTROLOGER-APP] Socket not connected, cannot restore session');
        return;
      }
      
      // Set reconnection flag to prevent duplicate operations
      this.reconnectionInProgress = true;
      
      // Step 1: Rejoin the appropriate room
      await this.rejoinRoomIfNeeded();
      
      // Step 2: Request current session state from backend
      console.log('🔄 [ASTROLOGER-APP] Requesting session state sync from backend');
      this.socket.emit('request_session_state', {
        bookingId: this.sessionState.bookingId || this.currentBookingId,
        sessionId: this.sessionState.sessionId,
        astrologerId: this.sessionState.astrologerId || this.currentAstrologerId,
        userId: this.sessionState.userId || this.currentUserId,
        isFreeChat: this.sessionState.isFreeChat || this.isFreeChat,
        freeChatId: this.sessionState.isFreeChat ? (this.sessionState.freeChatId || this.freeChatId) : null,
        socketId: this.persistentSocketId,
        reconnection: true
      });
      
      // Step 3: Set timeout to clear reconnection flag
      setTimeout(() => {
        this.reconnectionInProgress = false;
        console.log('✅ [ASTROLOGER-APP] Session restoration completed');
      }, 5000);
      
    } catch (error) {
      console.error('❌ [ASTROLOGER-APP] Error during session restoration:', error);
      this.reconnectionInProgress = false;
    }
  }

  /**
   * Initialize connection with booking details or free chat options
   */
  async initialize(bookingId, astrologerId, userId = null, options = {}) {
    console.log('🔴 [ASTROLOGER-APP] [ChatConnectionManager] Initializing with:', { bookingId, astrologerId, userId, options });
    
    this.currentBookingId = bookingId;
    this.currentAstrologerId = astrologerId;
    this.currentUserId = userId;
    
    // 🔄 Initialize session state with current session details
    this.sessionState.bookingId = bookingId;
    this.sessionState.astrologerId = astrologerId;
    this.sessionState.userId = userId;
    
    // Handle free chat initialization
    if (options.isFreeChat) {
      console.log('🔴 [ASTROLOGER-APP] [ChatConnectionManager] Initializing for FREE CHAT session');
      this.isFreeChat = true;
      this.freeChatId = options.freeChatId || bookingId; // Use bookingId as freeChatId for compatibility
      this.sessionId = options.sessionId;
      
      // Update session state for free chat
      this.sessionState.isFreeChat = true;
      this.sessionState.freeChatId = this.freeChatId;
      this.sessionState.sessionId = this.sessionId;
      
      console.log('🔴 [ASTROLOGER-APP] [ChatConnectionManager] Free chat details:', {
        isFreeChat: this.isFreeChat,
        freeChatId: this.freeChatId,
        sessionId: this.sessionId,
        sessionState: this.sessionState
      });
    } else {
      console.log('🔴 [ASTROLOGER-APP] [ChatConnectionManager] Initializing for REGULAR BOOKING session');
      this.isFreeChat = false;
      this.freeChatId = null;
      this.sessionId = null;
      
      // Update session state for regular booking
      this.sessionState.isFreeChat = false;
      this.sessionState.freeChatId = null;
      this.sessionState.sessionId = null;
    }
    
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
   * 🔄 Enhanced event listener cleanup to prevent duplicates and race conditions
   */
  cleanupEventListeners() {
    if (!this.socket) return;
    
    console.log('🧹 [ASTROLOGER-APP] Comprehensive event listener cleanup to prevent duplicates and UI flickering');
    
    // 🔥 CRITICAL: Remove ALL existing listeners to prevent duplicates and race conditions
    this.socket.removeAllListeners();
    
    console.log('✅ [ASTROLOGER-APP] All event listeners removed - clean slate for fresh registration');
  }

  /**
   * Set up socket event listeners
   */
  setupEventListeners() {
    if (!this.socket) return;
    
    // 🚨 CRITICAL: Clean up existing listeners first to prevent UI flickering
    this.cleanupEventListeners();
    
    console.log('[ChatConnectionManager] 🔄 Setting up fresh event listeners');

    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on('connect_error', this.handleConnectError);
    this.socket.on('reconnect', this.handleReconnect);

    // 💬 Enhanced message handling with session state validation
    this.socket.on('receive_message', (message) => {
      console.log('💬 [ASTROLOGER-APP] Received message event:', message);
      console.log('💬 [ASTROLOGER-APP] Message roomId:', message.roomId);
      console.log('💬 [ASTROLOGER-APP] Is free chat session:', this.isFreeChat);
      console.log('💬 [ASTROLOGER-APP] Current bookingId:', this.currentBookingId);
      console.log('💬 [ASTROLOGER-APP] Current freeChatId:', this.freeChatId);
      console.log('💬 [ASTROLOGER-APP] Reconnection in progress:', this.reconnectionInProgress);
      
      let messageAccepted = false;
      
      if (this.isFreeChat) {
        // For free chat, check free chat room format
        const expectedFreeChatRoom = `free_chat:${this.freeChatId}`;
        console.log('💬 [ASTROLOGER-APP] [FREE_CHAT] Expected free chat room:', expectedFreeChatRoom);
        
        if (message.roomId === expectedFreeChatRoom || message.roomId === this.freeChatId) {
          console.log('💬 [ASTROLOGER-APP] [FREE_CHAT] ✅ Message accepted for free chat session');
          messageAccepted = true;
        } else {
          console.log('💬 [ASTROLOGER-APP] [FREE_CHAT] ❌ Message rejected - free chat room ID mismatch');
        }
      } else {
        // For regular booking, check consultation room format
        const expectedBookingRoom = `consultation:${this.currentBookingId}`;
        console.log('💬 [ASTROLOGER-APP] [BOOKING] Expected booking room:', expectedBookingRoom);
        
        if (message.roomId === expectedBookingRoom || message.roomId === this.currentBookingId) {
          console.log('💬 [ASTROLOGER-APP] [BOOKING] ✅ Message accepted for booking session');
          messageAccepted = true;
        } else {
          console.log('💬 [ASTROLOGER-APP] [BOOKING] ❌ Message rejected - booking room ID mismatch');
        }
      }
      
      if (messageAccepted) {
        console.log('💬 [ASTROLOGER-APP] Message accepted, normalizing fields');
        
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
        
        // Only notify if not in reconnection process to prevent duplicate messages
        if (!this.reconnectionInProgress) {
          this.notifyMessage(normalizedMessage);
        } else {
          console.log('💬 [ASTROLOGER-APP] Message received during reconnection - notification skipped');
        }
      } else {
        console.log('🔴 [ASTROLOGER-APP] Message rejected - roomId mismatch');
      }
    });

    this.socket.on('typing_started', (data) => {
      console.log('⌨️ [ASTROLOGER-APP] Typing started event received:', data);
      console.log('⌨️ [ASTROLOGER-APP] Is free chat session:', this.isFreeChat);
      console.log('⌨️ [ASTROLOGER-APP] Current bookingId:', this.currentBookingId);
      console.log('⌨️ [ASTROLOGER-APP] Current freeChatId:', this.freeChatId);
      console.log('⌨️ [ASTROLOGER-APP] Event bookingId:', data.bookingId);
      
      // Handle both free chat and regular booking typing events
      const isMatchingSession = this.isFreeChat 
        ? (data.bookingId === `free_chat:${this.freeChatId}` || data.bookingId === this.freeChatId)
        : (data.bookingId === this.currentBookingId);
      
      if (isMatchingSession) {
        console.log('⌨️ [ASTROLOGER-APP] ✅ Typing started for current session');
        this.notifyTyping(true, data);
      } else {
        console.log('⌨️ [ASTROLOGER-APP] ❌ Typing started for different session - ignoring');
      }
    });

    this.socket.on('typing_stopped', (data) => {
      console.log('⌨️ [ASTROLOGER-APP] Typing stopped event received:', data);
      console.log('⌨️ [ASTROLOGER-APP] Is free chat session:', this.isFreeChat);
      console.log('⌨️ [ASTROLOGER-APP] Current bookingId:', this.currentBookingId);
      console.log('⌨️ [ASTROLOGER-APP] Current freeChatId:', this.freeChatId);
      console.log('⌨️ [ASTROLOGER-APP] Event bookingId:', data.bookingId);
      
      // Handle both free chat and regular booking typing events
      const isMatchingSession = this.isFreeChat 
        ? (data.bookingId === `free_chat:${this.freeChatId}` || data.bookingId === this.freeChatId)
        : (data.bookingId === this.currentBookingId);
      
      if (isMatchingSession) {
        console.log('⌨️ [ASTROLOGER-APP] ✅ Typing stopped for current session');
        this.notifyTyping(false, data);
      } else {
        console.log('⌨️ [ASTROLOGER-APP] ❌ Typing stopped for different session - ignoring');
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

    // New session timer events from backend
    this.socket.on('session_timer_started', (data) => {
      console.log('🔴 [ASTROLOGER-APP] Session timer started event received:', data);
      console.log('🔴 [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('🔴 [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      
      if (data.bookingId === this.currentBookingId || data.bookingId == this.currentBookingId) {
        console.log('🔴 [ASTROLOGER-APP] ✅ Timer started for current booking - activating session');
        this.notifyConnectionStatus('session_active', 'Session timer started');
        this.notifyStatusUpdate({ 
          type: 'session_started', 
          data,
          sessionId: data.sessionId,
          duration: data.duration || 0
        });
      } else {
        console.log('🔴 [ASTROLOGER-APP] ❌ Timer started for different booking - ignoring');
      }
    });

    this.socket.on('session_timer_update', (data) => {
      console.log('🔴 [ASTROLOGER-APP] Session timer update received:', data);
      console.log('🔴 [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('🔴 [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      
      if (data.bookingId === this.currentBookingId || data.bookingId == this.currentBookingId) {
        console.log('🔴 [ASTROLOGER-APP] ✅ Timer update for current booking:', data.formattedTime);
        this.notifyStatusUpdate({ 
          type: 'timer', 
          durationSeconds: data.duration,
          seconds: data.duration,
          formattedTime: data.formattedTime,
          sessionId: data.sessionId
        });
      } else {
        console.log('🔴 [ASTROLOGER-APP] ❌ Timer update for different booking - ignoring');
      }
    });

    // Session timer event (main timer event from backend)
    this.socket.on('session_timer', (data) => {
      console.log('⏰ [ASTROLOGER-APP] Session timer event received:', data);
      console.log('⏰ [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('⏰ [ASTROLOGER-APP] Current free chat ID:', this.freeChatId);
      console.log('⏰ [ASTROLOGER-APP] Event session ID:', data.sessionId);
      console.log('⏰ [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      console.log('⏰ [ASTROLOGER-APP] Event free chat ID:', data.freeChatId);
      console.log('⏰ [ASTROLOGER-APP] Reconnection in progress:', this.reconnectionInProgress);
      
      // Handle both free chat and regular booking timer events
      let isMatchingSession = false;
      
      if (this.isFreeChat) {
        // For free chat, check free chat ID
        if (data.freeChatId === this.freeChatId || data.sessionId === this.sessionId) {
          console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] ✅ Timer event for current free chat session');
          isMatchingSession = true;
        } else {
          console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] ❌ Timer event for different free chat session - ignoring');
        }
      } else {
        // For regular booking, check booking ID
        if (data.bookingId === this.currentBookingId || data.sessionId === this.sessionId) {
          console.log('⏰ [ASTROLOGER-APP] [BOOKING] ✅ Timer event for current booking session');
          isMatchingSession = true;
        } else {
          console.log('⏰ [ASTROLOGER-APP] [BOOKING] ❌ Timer event for different booking session - ignoring');
        }
      }
      
      if (isMatchingSession) {
        // 🔄 Update session state with latest timer information
        this.sessionState.isActive = true;
        this.sessionState.sessionId = data.sessionId || this.sessionState.sessionId;
        this.sessionState.bookingId = data.bookingId || this.currentBookingId;
        this.sessionState.freeChatId = data.freeChatId || this.freeChatId;
        this.sessionState.lastTimerUpdate = Date.now();
        this.sessionState.isFreeChat = data.freeChatId ? true : false;
        
        console.log('⏰ [ASTROLOGER-APP] Timer data:', {
          durationSeconds: data.durationSeconds,
          durationMinutes: data.durationMinutes,
          timeRemaining: data.timeRemaining,
          currentAmount: data.currentAmount,
          sessionState: this.sessionState
        });
        
        // Only notify if not in reconnection process to prevent duplicate updates
        if (!this.reconnectionInProgress) {
          this.notifyStatusUpdate({ 
            type: 'timer', 
            durationSeconds: data.durationSeconds,
            durationMinutes: data.durationMinutes,
            timeRemaining: data.timeRemaining,
            currentAmount: data.currentAmount,
            currency: data.currency,
            sessionId: data.sessionId,
            bookingId: data.bookingId,
            freeChatId: data.freeChatId
          });
        } else {
          console.log('⏰ [ASTROLOGER-APP] Timer update received during reconnection - state updated but notification skipped');
        }
      }
    });

    // 🔄 Enhanced session state response handler for comprehensive synchronization
    this.socket.on('session_state_response', (data) => {
      console.log('🔄 [ASTROLOGER-APP] Session state response received:', data);
      
      if (data.success && data.sessionState) {
        const backendSessionState = data.sessionState;
        console.log('🔄 [ASTROLOGER-APP] Synchronizing with backend session state:', backendSessionState);
        
        // Update local session state with backend data
        this.sessionState.isActive = backendSessionState.isActive || backendSessionState.status === 'connected';
        this.sessionState.sessionId = backendSessionState.sessionId || backendSessionState._id;
        this.sessionState.bookingId = backendSessionState.bookingId || this.currentBookingId;
        this.sessionState.astrologerId = backendSessionState.astrologerId || this.currentAstrologerId;
        this.sessionState.userId = backendSessionState.userId || this.currentUserId;
        this.sessionState.lastTimerUpdate = Date.now();
        this.sessionState.isFreeChat = backendSessionState.isFreeChat || this.isFreeChat;
        this.sessionState.freeChatId = backendSessionState.freeChatId || this.freeChatId;
        
        console.log('🔄 [ASTROLOGER-APP] Updated local session state:', this.sessionState);
        
        // If session is active, notify UI to restore session
        if (this.sessionState.isActive) {
          console.log('🔄 [ASTROLOGER-APP] Session is active - notifying UI for restoration');
          this.notifyStatusUpdate({
            type: 'session_restored',
            sessionState: this.sessionState,
            backendState: backendSessionState,
            durationSeconds: backendSessionState.currentDuration || 0
          });
          
          // If backend provides current timer state, sync it
          if (backendSessionState.currentDuration !== undefined) {
            this.notifyStatusUpdate({
              type: 'timer',
              durationSeconds: backendSessionState.currentDuration,
              seconds: backendSessionState.currentDuration,
              sessionId: this.sessionState.sessionId,
              restored: true
            });
          }
        }
      } else {
        console.log('🔄 [ASTROLOGER-APP] Session state sync failed or no active session:', data);
        this.sessionState.isActive = false;
      }
    });
    
    // Listen for free chat session ended event
    this.socket.on('free_chat_session_ended', (data) => {
      console.log('🛑 [ASTROLOGER-APP] Free chat session ended event received:', data);
      console.log('🛑 [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('🛑 [ASTROLOGER-APP] Current free chat ID:', this.freeChatId);
      console.log('🛑 [ASTROLOGER-APP] Event sessionId:', data.sessionId);
      console.log('🛑 [ASTROLOGER-APP] Event freeChatId:', data.freeChatId);
      
      // Check if this event is for the current session
      let isMatchingSession = false;
      
      if (this.isFreeChat) {
        // For free chat, match against freeChatId or sessionId
        isMatchingSession = (
          data.freeChatId === this.freeChatId || 
          data.freeChatId === this.currentBookingId ||
          data.sessionId === this.sessionId
        );
      }
      
      if (isMatchingSession) {
        console.log('🛑 [ASTROLOGER-APP] ✅ Free chat session ended for current session');
        
        // Notify status update for session end
        this.notifyStatusUpdate({
          type: 'session_end',
          sessionId: data.sessionId,
          freeChatId: data.freeChatId,
          duration: data.duration || 0,
          endedBy: data.endedBy || 'user',
          timestamp: new Date().toISOString(),
          message: 'Free chat session ended'
        });
      } else {
        console.log('🛑 [ASTROLOGER-APP] ❌ Free chat session ended for different session - ignoring');
      }
    });

    this.socket.on('consultation_ended', (data) => {
      console.log('🔴 [ASTROLOGER-APP] Consultation ended event received:', data);
      console.log('🔴 [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('🔴 [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      
      if (data.bookingId === this.currentBookingId) {
        console.log('🔴 [ASTROLOGER-APP] Processing consultation end - ended by:', data.endedBy);
        
        // Update session state to inactive
        this.sessionState.isActive = false;
        
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

    // 🔄 Enhanced session end event handler with comprehensive session state management
    this.socket.on('session_ended', (data) => {
      console.log('🔚 [ASTROLOGER-APP] Session ended event received:', data);
      console.log('🔚 [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('🔚 [ASTROLOGER-APP] Current free chat ID:', this.freeChatId);
      console.log('🔚 [ASTROLOGER-APP] Event session ID:', data.sessionId);
      console.log('🔚 [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      console.log('🔚 [ASTROLOGER-APP] End reason:', data.reason);
      console.log('🔚 [ASTROLOGER-APP] Auto ended:', data.autoEnded);
      
      // Handle both free chat and regular booking session end events
      let isMatchingSession = false;
      
      if (this.isFreeChat) {
        // For free chat, check free chat ID or session ID
        if (data.freeChatId === this.freeChatId || data.sessionId === this.sessionId) {
          console.log('🔚 [ASTROLOGER-APP] [FREE_CHAT] ✅ Session ended for current free chat session');
          isMatchingSession = true;
        }
      } else {
        // For regular booking, check booking ID or session ID
        if (data.bookingId === this.currentBookingId || data.sessionId === this.sessionId) {
          console.log('🔚 [ASTROLOGER-APP] [BOOKING] ✅ Session ended for current booking session');
          isMatchingSession = true;
        }
      }
      
      if (isMatchingSession) {
        console.log('🔚 [ASTROLOGER-APP] Notifying session end to UI components');
        
        // Update session state to inactive
        this.sessionState.isActive = false;
        
        this.notifyConnectionStatus('session_ended', data.message || 'Session has ended');
        this.notifyStatusUpdate({ 
          type: 'session_ended', 
          reason: data.reason,
          finalDuration: data.finalDuration,
          finalAmount: data.finalAmount,
          autoEnded: data.autoEnded,
          message: data.message,
          sessionId: data.sessionId,
          bookingId: data.bookingId,
          freeChatId: data.freeChatId,
          timestamp: data.timestamp
        });
      } else {
        console.log('🔚 [ASTROLOGER-APP] Session ended event ignored - session ID mismatch');
      }
    });

    this.socket.on('chat_ended', (data) => {
      console.log('💬🔚 [ASTROLOGER-APP] Chat ended event received:', data);
      console.log('💬🔚 [ASTROLOGER-APP] Current booking ID:', this.currentBookingId);
      console.log('💬🔚 [ASTROLOGER-APP] Current free chat ID:', this.freeChatId);
      console.log('💬🔚 [ASTROLOGER-APP] Event session ID:', data.sessionId);
      console.log('💬🔚 [ASTROLOGER-APP] Event booking ID:', data.bookingId);
      console.log('💬🔚 [ASTROLOGER-APP] End reason:', data.reason);
      
      // Handle both free chat and regular booking chat end events
      let isMatchingSession = false;
      
      if (this.isFreeChat) {
        // For free chat, check free chat ID or session ID
        if (data.freeChatId === this.freeChatId || data.sessionId === this.sessionId) {
          console.log('💬🔚 [ASTROLOGER-APP] [FREE_CHAT] ✅ Chat ended for current free chat session');
          isMatchingSession = true;
        }
      } else {
        // For regular booking, check booking ID or session ID
        if (data.bookingId === this.currentBookingId || data.sessionId === this.sessionId) {
          console.log('💬🔚 [ASTROLOGER-APP] [BOOKING] ✅ Chat ended for current booking session');
          isMatchingSession = true;
        }
      }
      
      if (isMatchingSession) {
        console.log('💬🔚 [ASTROLOGER-APP] Notifying chat end to UI components');
        this.notifyConnectionStatus('chat_ended', 'Chat session has ended');
        this.notifyStatusUpdate({ 
          type: 'chat_ended', 
          reason: data.reason,
          finalDuration: data.finalDuration,
          finalAmount: data.finalAmount,
          autoEnded: data.autoEnded,
          sessionId: data.sessionId,
          bookingId: data.bookingId,
          freeChatId: data.freeChatId,
          timestamp: data.timestamp
        });
      } else {
        console.log('💬🔚 [ASTROLOGER-APP] Chat ended event ignored - session ID mismatch');
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

    // ===== FREE CHAT SPECIFIC EVENT HANDLERS =====
    
    // Free chat session started event
    this.socket.on('session_started', (data) => {
      console.log('🎆 [ASTROLOGER-APP] [FREE_CHAT] Session started event received:', data);
      console.log('🎆 [ASTROLOGER-APP] [FREE_CHAT] Is free chat session:', this.isFreeChat);
      console.log('🎆 [ASTROLOGER-APP] [FREE_CHAT] Current freeChatId:', this.freeChatId);
      console.log('🎆 [ASTROLOGER-APP] [FREE_CHAT] Event freeChatId:', data.freeChatId);
      console.log('🎆 [ASTROLOGER-APP] [FREE_CHAT] Event bookingId:', data.bookingId);
      
      // Handle both free chat and regular booking sessions
      const isMatchingSession = this.isFreeChat 
        ? (data.freeChatId === this.freeChatId || data.bookingId === this.freeChatId)
        : (data.bookingId === this.currentBookingId);
      
      if (isMatchingSession) {
        console.log('🎆 [ASTROLOGER-APP] [FREE_CHAT] ✅ Session started for current session - activating');
        
        // Store session start time for reconnection scenarios
        this.sessionStartTime = new Date();
        this.sessionDuration = data.duration || 180;
        
        this.notifyConnectionStatus('session_active', 'Session started');
        this.notifyStatusUpdate({ 
          type: 'session_started', 
          data,
          sessionId: data.sessionId,
          duration: data.duration || 180,
          isFreeChat: data.isFreeChat || this.isFreeChat
        });
      } else {
        console.log('🎆 [ASTROLOGER-APP] [FREE_CHAT] ❌ Session started for different session - ignoring');
      }
    });
    
    // Free chat session resumed event (for reconnection scenarios)
    this.socket.on('free_chat_session_resumed', (data) => {
      console.log('🔄 [ASTROLOGER-APP] [FREE_CHAT] Session resumed event received:', data);
      console.log('🔄 [ASTROLOGER-APP] [FREE_CHAT] Is free chat session:', this.isFreeChat);
      console.log('🔄 [ASTROLOGER-APP] [FREE_CHAT] Current freeChatId:', this.freeChatId);
      console.log('🔄 [ASTROLOGER-APP] [FREE_CHAT] Event freeChatId:', data.freeChatId);
      
      // Check if this is for our current free chat session
      const isMatchingSession = this.isFreeChat && 
        (data.freeChatId === this.freeChatId || data.bookingId === this.freeChatId);
      
      if (isMatchingSession) {
        console.log('🔄 [ASTROLOGER-APP] [FREE_CHAT] ✅ Session resumed for current free chat');
        
        // Update session state with resumed data
        this.sessionStartTime = new Date(data.startTime) || new Date();
        this.sessionDuration = data.duration || 180;
        
        // Calculate remaining time based on backend data
        const timeRemaining = data.timeRemaining || 0;
        
        console.log('🔄 [ASTROLOGER-APP] [FREE_CHAT] Session resumed with:', {
          timeRemaining,
          startTime: this.sessionStartTime,
          duration: this.sessionDuration
        });
        
        // Notify UI about session resumption
        this.notifyConnectionStatus('session_resumed', 'Session resumed after reconnection');
        this.notifyStatusUpdate({ 
          type: 'session_resumed', 
          timeRemaining,
          sessionId: data.sessionId,
          startTime: this.sessionStartTime,
          duration: this.sessionDuration,
          isFreeChat: true
        });
        
        // Request message history to catch up on missed messages
        this.requestMessageHistory();
      } else {
        console.log('🔄 [ASTROLOGER-APP] [FREE_CHAT] ❌ Session resumed for different session - ignoring');
      }
    });
    
    // Free chat session timer updates
    this.socket.on('session_timer', (data) => {
      console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] Session timer event received:', data);
      console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] Is free chat session:', this.isFreeChat);
      console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] Current freeChatId:', this.freeChatId);
      console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] Event freeChatId:', data.freeChatId);
      console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] Event bookingId:', data.bookingId);
      
      // Handle both free chat and regular booking timer updates
      const isMatchingSession = this.isFreeChat 
        ? (data.freeChatId === this.freeChatId || data.bookingId === this.freeChatId)
        : (data.bookingId === this.currentBookingId);
      
      if (isMatchingSession) {
        console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] ✅ Timer update for current session:', data.timeRemaining);
        this.notifyStatusUpdate({ 
          type: 'timer', 
          durationSeconds: data.durationSeconds,
          seconds: data.durationSeconds,
          timeRemaining: data.timeRemaining,
          sessionId: data.sessionId,
          currentAmount: data.currentAmount || 0
        });
      } else {
        console.log('⏰ [ASTROLOGER-APP] [FREE_CHAT] ❌ Timer update for different session - ignoring');
      }
    });
    
    // Free chat session end event
    this.socket.on('session_end', (data) => {
      console.log('🛑 [ASTROLOGER-APP] [FREE_CHAT] Session end event received:', data);
      console.log('🛑 [ASTROLOGER-APP] [FREE_CHAT] Is free chat session:', this.isFreeChat);
      console.log('🛑 [ASTROLOGER-APP] [FREE_CHAT] Current freeChatId:', this.freeChatId);
      console.log('🛑 [ASTROLOGER-APP] [FREE_CHAT] Event freeChatId:', data.freeChatId);
      console.log('🛑 [ASTROLOGER-APP] [FREE_CHAT] Event bookingId:', data.bookingId);
      
      // Handle both free chat and regular booking session end
      const isMatchingSession = this.isFreeChat 
        ? (data.freeChatId === this.freeChatId || data.bookingId === this.freeChatId)
        : (data.bookingId === this.currentBookingId);
      
      if (isMatchingSession) {
        console.log('🛑 [ASTROLOGER-APP] [FREE_CHAT] ✅ Session ended for current session');
        this.notifyConnectionStatus('session_ended', 'Session ended');
        this.notifyStatusUpdate({ 
          type: 'session_end', 
          data,
          duration: data.duration,
          reason: data.reason,
          sessionId: data.sessionId
        });
      } else {
        console.log('🛑 [ASTROLOGER-APP] [FREE_CHAT] ❌ Session ended for different session - ignoring');
      }
    });
    
    // Free chat room joined confirmation
    this.socket.on('free_chat_room_joined', (data) => {
      console.log('🏠 [ASTROLOGER-APP] [FREE_CHAT] Room joined confirmation:', data);
      if (this.isFreeChat && data.freeChatId === this.freeChatId) {
        console.log('🏠 [ASTROLOGER-APP] [FREE_CHAT] ✅ Successfully joined free chat room');
        this.notifyConnectionStatus('room_joined', 'Joined free chat room');
        
        // If this is a reconnection scenario, attempt to resume the session
        const previousSocketId = AsyncStorage.getItem('astrologer_previous_socket_id')
          .then(id => {
            if (id && id !== this.socket?.id) {
              console.log('🏠 [ASTROLOGER-APP] [FREE_CHAT] Reconnection detected after room join - attempting to resume session');
              this.resumeFreeChatSession();
            }
          })
          .catch(err => {
            console.error('🏠 [ASTROLOGER-APP] [FREE_CHAT] Error checking previous socket ID:', err);
          });
      }
    });
    
    // Message history response
    this.socket.on('free_chat_message_history', (data) => {
      console.log('📚 [ASTROLOGER-APP] [FREE_CHAT] Message history received:', data);
      if (this.isFreeChat && data.freeChatId === this.freeChatId) {
        console.log(`📚 [ASTROLOGER-APP] [FREE_CHAT] ✅ Received ${data.messages?.length || 0} messages from history`);
        this.handleMessageHistoryResponse(data);
      }
    });
    
    // Free chat room join error
    this.socket.on('room_join_error', (data) => {
      console.log('❌ [ASTROLOGER-APP] [FREE_CHAT] Room join error:', data);
      if (this.isFreeChat) {
        console.log('❌ [ASTROLOGER-APP] [FREE_CHAT] Failed to join free chat room:', data.message);
        this.notifyConnectionStatus('error', data.message || 'Failed to join free chat room');
      }
    });
  }

  /**
   * Handle successful connection 
   * Enhanced connection handler with session restoration
   */
  handleConnect() {
    console.log(' [ASTROLOGER-APP] Connected to server - initiating session restoration');
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    
    this.notifyConnectionStatus('connected');
    
    // Process queued messages
    this.processMessageQueue();
    
    // Restore session after successful connection
    this.restoreSessionAfterReconnect();
    setTimeout(async () => {
      try {
        // Handle reconnection room joining logic
        await this.handleReconnectionRoomJoining();
        
        // Join current session room if any
        this.joinRoom();
        
        // Flush queued messages
        this.flushMessageQueue();
        
      } catch (error) {
        console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Error during connection setup:', error);
      }
    }, 500); // 500ms delay to ensure backend event handlers are registered
  }

  /**
   * Handle disconnection
   */
  handleDisconnect(reason) {
    console.log('[ChatConnectionManager] Disconnected:', reason);
    this.isConnected = false;
    this.isConnecting = false;
    
    // 🚨 CRITICAL: Clean up event listeners on disconnect to prevent UI flickering
    console.log('[ChatConnectionManager] 🧹 Cleaning up event listeners on disconnect');
    this.cleanupEventListeners();
    
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
   * Schedule reconnection with exponential backoff and app state awareness
   */
  scheduleReconnect() {
    // Don't reconnect if app is in background
    if (this.appState !== 'active') {
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Skipping reconnect - app not active:', this.appState);
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Max reconnection attempts reached');
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

    console.log(`🔄 [ASTROLOGER-APP] [ChatConnectionManager] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.notifyConnectionStatus('reconnecting', `Reconnecting in ${Math.ceil(delay / 1000)}s...`);

    this.reconnectTimer = setTimeout(() => {
      // Double-check app state before attempting reconnection
      if (this.appState === 'active') {
        this.reconnectAttempts++;
        this.connect();
      } else {
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Cancelling reconnect - app no longer active');
      }
    }, delay);
  }

  /**
   * Handle app state changes with comprehensive reconnection logic
   */
  handleAppStateChange(nextAppState) {
    console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] App state changed:', this.appState, '->', nextAppState);
    
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground - implement robust reconnection
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] App foregrounded - checking connection status');
      
      if (!this.isConnected && !this.isConnecting) {
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Not connected - initiating reconnection');
        this.handleReconnectionOnAppForeground();
      } else if (this.isConnected) {
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Already connected - verifying session state');
        this.handleReconnectionRoomJoining();
      }
    } else if (nextAppState === 'background') {
      // App went to background - preserve connection but stop reconnection attempts
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] App backgrounded - preserving connection');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    }
    
    this.appState = nextAppState;
  }

  /**
   * Handle reconnection when app comes to foreground
   */
  async handleReconnectionOnAppForeground() {
    try {
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Starting reconnection process...');
      
      // Reset reconnection attempts for fresh start
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      // Attempt to reconnect
      await this.connect();
      
    } catch (error) {
      console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Error during app foreground reconnection:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle room rejoining after reconnection
   */
  async handleReconnectionRoomJoining() {
    try {
      console.log(' [ASTROLOGER-APP] [ChatConnectionManager] Handling reconnection room joining...');
      
      // Check if this is a reconnection by comparing socket IDs
      const previousSocketId = await AsyncStorage.getItem('astrologer_previous_socket_id');
      const currentSocketId = this.socket?.id;
      
      if (previousSocketId && currentSocketId && previousSocketId !== currentSocketId) {
        console.log(' [ASTROLOGER-APP] [ChatConnectionManager] Reconnection detected - rejoining rooms');
        console.log(' [ASTROLOGER-APP] [ChatConnectionManager] Previous socket ID:', previousSocketId);
        console.log(' [ASTROLOGER-APP] [ChatConnectionManager] Current socket ID:', currentSocketId);
        
        // Store new socket ID
        await AsyncStorage.setItem('astrologer_previous_socket_id', currentSocketId);
        
        // Rejoin notification room
        await this.joinNotificationRoom();
        
        // Rejoin active session rooms if any
        await this.rejoinActiveSessionRooms();
        
        // For free chat sessions, check if we need to resume the session
        if (this.isFreeChat && this.freeChatId) {
          console.log(' [ASTROLOGER-APP] [ChatConnectionManager] Attempting to resume free chat session:', this.freeChatId);
          this.resumeFreeChatSession();
        }
        
      } else if (!previousSocketId && currentSocketId) {
        // First connection - store socket ID
        await AsyncStorage.setItem('astrologer_previous_socket_id', currentSocketId);
        console.log(' [ASTROLOGER-APP] [ChatConnectionManager] First connection - stored socket ID:', currentSocketId);
      }
      
    } catch (error) {
      console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Error during reconnection room joining:', error);
    }
  }

  /**
   * Join astrologer notification room
   */
  async joinNotificationRoom() {
    try {
      if (!this.isConnected || !this.socket || !this.currentAstrologerId) {
        console.warn('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Cannot join notification room - missing requirements');
        return;
      }
      
      const notificationRoom = `astrologer_${this.currentAstrologerId}`;
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Joining notification room:', notificationRoom);
      
      this.socket.emit('join_room', {
        roomId: notificationRoom,
        userType: 'astrologer',
        userId: this.currentAstrologerId
      });
      
      // Verify room join
      setTimeout(() => {
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Notification room join completed for:', notificationRoom);
      }, 1000);
      
    } catch (error) {
      console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Error joining notification room:', error);
    }
  }

  /**
   * Rejoin active session rooms after reconnection
   */
  async rejoinActiveSessionRooms() {
    try {
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Checking for active sessions to rejoin...');
      
      if (!this.isConnected || !this.socket || !this.currentAstrologerId) {
        console.warn('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Cannot rejoin session rooms - missing requirements');
        return;
      }
      
      // If we have an active booking/free chat session, rejoin the room
      if (this.currentBookingId || this.freeChatId) {
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Found active session - rejoining room');
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Current booking ID:', this.currentBookingId);
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Current free chat ID:', this.freeChatId);
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Is free chat:', this.isFreeChat);
        
        // Rejoin the appropriate room
        this.joinRoom();
        
        // Notify that we're back in the session
        this.notifyConnectionStatus('session_rejoined', 'Rejoined active session after reconnection');
        
        // For free chat sessions, we'll handle session resumption separately
        // in the resumeFreeChatSession method after room joining is confirmed
        
      } else {
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] No active session found to rejoin');
      }
      
    } catch (error) {
      console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Error rejoining active session rooms:', error);
    }
  }
  
  /**
   * Resume free chat session after reconnection
   */
  resumeFreeChatSession() {
    try {
      if (!this.isConnected || !this.socket || !this.freeChatId || !this.isFreeChat) {
        console.warn('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Cannot resume free chat - missing requirements');
        return;
      }
      
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Attempting to resume free chat session:', this.freeChatId);
      
      // Emit event to backend to resume the session
      this.socket.emit('resume_free_chat_session', {
        freeChatId: this.freeChatId,
        sessionId: this.sessionId,
        userId: this.currentAstrologerId,
        userType: 'astrologer'
      });
      
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Sent resume_free_chat_session event');
      
    } catch (error) {
      console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Error resuming free chat session:', error);
    }
  }
  
  /**
   * Request message history after reconnection
   */
  requestMessageHistory() {
    try {
      if (!this.isConnected || !this.socket) {
        console.warn('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Cannot request message history - not connected');
        return;
      }
      
      if (this.isFreeChat && this.freeChatId) {
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Requesting free chat message history for:', this.freeChatId);
        
        // Request message history from backend
        this.socket.emit('get_free_chat_message_history', {
          freeChatId: this.freeChatId,
          userId: this.currentAstrologerId,
          userType: 'astrologer'
        }, (response) => {
          // Handle response with message history
          this.handleMessageHistoryResponse(response);
        });
        
      } else if (this.currentBookingId) {
        console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Requesting booking message history for:', this.currentBookingId);
        
        // Request message history for regular booking
        this.socket.emit('get_chat_message_history', {
          bookingId: this.currentBookingId,
          userId: this.currentAstrologerId,
          userType: 'astrologer'
        }, (response) => {
          // Handle response with message history
          this.handleMessageHistoryResponse(response);
        });
      }
      
    } catch (error) {
      console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Error requesting message history:', error);
    }
  }
  
  /**
   * Handle message history response
   */
  handleMessageHistoryResponse(response) {
    try {
      console.log('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Received message history response:', response);
      
      if (!response || !response.success) {
        console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Failed to get message history:', response?.error || 'Unknown error');
        return;
      }
      
      const messages = response.messages || [];
      console.log(`🔄 [ASTROLOGER-APP] [ChatConnectionManager] Retrieved ${messages.length} messages from history`);
      
      // Process each message and notify UI
      messages.forEach(message => {
        // Normalize message format
        const normalizedMessage = {
          id: message.id || message.messageId || `msg_${Date.now()}_${Math.random()}`,
          content: message.content || message.text || message.message || '',
          text: message.content || message.text || message.message || '',
          message: message.content || message.text || message.message || '',
          sender: message.sender || message.senderRole || 'unknown',
          senderId: message.senderId || message.sender || 'unknown',
          senderRole: message.senderRole || message.sender || 'unknown',
          senderName: message.senderName || (message.senderRole === 'user' ? 'User' : 'Astrologer'),
          timestamp: message.timestamp || new Date().toISOString(),
          roomId: message.roomId,
          status: 'history',
          isHistory: true // Mark as history message
        };
        
        // Notify UI about this message
        this.notifyMessage(normalizedMessage);
      });
      
      // Notify UI that history is complete
      if (messages.length > 0) {
        this.notifyStatusUpdate({
          type: 'message_history_loaded',
          count: messages.length
        });
      }
      
    } catch (error) {
      console.error('🔄 [ASTROLOGER-APP] [ChatConnectionManager] Error handling message history:', error);
    }
  }

  /**
   * Join chat room (supports both booking and free chat)
   */
  joinRoom() {
    if (!this.isConnected || !this.socket) {
      console.warn('🔴 [ASTROLOGER-APP] [ChatConnectionManager] Cannot join room - not connected');
      return;
    }
    
    if (this.isFreeChat) {
      // Join free chat room
      if (!this.freeChatId) {
        console.warn('🔴 [ASTROLOGER-APP] [ChatConnectionManager] Cannot join free chat room - missing freeChatId');
        return;
      }
      
      console.log('🏠 [ASTROLOGER-APP] [ChatConnectionManager] Joining FREE CHAT room:', this.freeChatId);
      
      this.socket.emit('join_free_chat_room', {
        freeChatId: this.freeChatId,
        sessionId: this.sessionId,
        userId: this.currentAstrologerId,
        userType: 'astrologer'
      });
      
      this.notifyConnectionStatus('joining', 'Joining free chat room...');
      
    } else {
      // Join regular booking consultation room
      if (!this.currentBookingId) {
        console.warn('🔴 [ASTROLOGER-APP] [ChatConnectionManager] Cannot join booking room - missing bookingId');
        return;
      }
      
      console.log('💼 [ASTROLOGER-APP] [ChatConnectionManager] Joining BOOKING consultation room:', this.currentBookingId);
      
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
   * End session - supports both regular and free chat sessions
   * @param {string} sessionId - ID of the session to end
   */
  endSession(sessionId) {
    console.log('🛑 [ASTROLOGER-APP] Ending session:', sessionId);
    console.log('🛑 [ASTROLOGER-APP] Is free chat:', this.isFreeChat);
    
    if (!this.isConnected || !this.socket) {
      console.error('🛑 [ASTROLOGER-APP] Cannot end session - socket not connected');
      return false;
    }
    
    // Use provided sessionId or fall back to stored sessionId
    const actualSessionId = sessionId || this.sessionId;
    
    try {
      if (this.isFreeChat) {
        // For free chat sessions
        console.log('🛑 [ASTROLOGER-APP] Ending FREE CHAT session:', {
          sessionId: actualSessionId,
          freeChatId: this.freeChatId
        });
        
        // Emit end_free_chat event to backend
        this.socket.emit('end_free_chat', { 
          sessionId: actualSessionId,
          freeChatId: this.freeChatId,
          endedBy: 'astrologer'
        });
        
        // Notify status update callbacks about session end
        this.notifyStatusUpdate({
          type: 'session_end',
          sessionId: actualSessionId,
          freeChatId: this.freeChatId,
          endedBy: 'astrologer',
          timestamp: new Date().toISOString(),
          message: 'Free chat session ended by astrologer'
        });
      } else {
        // For regular booking sessions
        console.log('🛑 [ASTROLOGER-APP] Ending REGULAR session:', {
          sessionId: actualSessionId,
          bookingId: this.currentBookingId
        });
        
        // Emit end_session event to backend
        this.socket.emit('end_session', { 
          sessionId: actualSessionId,
          bookingId: this.currentBookingId,
          endedBy: 'astrologer'
        });
        
        // Notify status update callbacks about session end
        this.notifyStatusUpdate({
          type: 'session_end',
          sessionId: actualSessionId,
          bookingId: this.currentBookingId,
          endedBy: 'astrologer',
          timestamp: new Date().toISOString(),
          message: 'Session ended by astrologer'
        });
      }
      
      return true;
    } catch (error) {
      console.error('🛑 [ASTROLOGER-APP] Error ending session:', error);
      return false;
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
