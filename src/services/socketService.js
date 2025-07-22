/**
 * Socket Service - Stateless utility functions for socket operations
 * 
 * This service has been refactored to be stateless. All functions now accept
 * a socket instance as an argument instead of using a global socket.
 * 
 * Socket initialization and management is now handled by SocketContext.
 *
 * Enhanced with typing indicator and read receipt functionality.
 */

// Constants
const BOOKING_REQUEST_TIMEOUT = 30000; // 30 seconds
const RESPONSE_TIMEOUT = 10000; // 10 seconds

/**
 * Respond to a booking request (accept or reject)
 * @param {Object} socket - Socket.io instance
 * @param {String} bookingId - Booking ID
 * @param {Boolean} accepted - Whether the booking is accepted
 * @returns {Promise<Object>} - Promise that resolves with response
 */
export const respondToBookingRequest = async (socket, bookingId, accepted) => {
  if (!socket || !socket.connected) {
    return Promise.reject(new Error('Socket not connected'));
  }
  
  // Send response
  return new Promise((resolve, reject) => {
    // Set timeout for response
    const timeout = setTimeout(() => {
      reject(new Error('Response timeout'));
    }, RESPONSE_TIMEOUT);
    
    // Convert boolean 'accepted' to string 'status' as expected by backend
    const status = accepted ? 'accepted' : 'rejected';
    
    // Listen for response
    socket.emit('booking_response', { bookingId, status }, (response) => {
      clearTimeout(timeout);
      
      if (response && response.success) {
        resolve(response);
      } else {
        console.error('Booking response error:', response);
        reject(new Error(response ? response.message : 'Unknown error'));
      }
    });
  });
};

/**
 * Listen for real-time booking requests
 * @param {Object} socket - Socket.io instance
 * @param {Function} onBookingRequest - Callback for new booking requests
 * @returns {Function} - Cleanup function to remove listener
 */
export const listenForBookingRequests = (socket, onBookingRequest) => {
  if (!socket || !socket.connected) {
    console.error('listenForBookingRequests: Socket not connected');
    return () => {};
  }
  
  console.log('Setting up listener for booking requests on socket:', socket.id);
  
  // Create a wrapper function to handle reliable socket messages
  const bookingRequestHandler = (data) => {
    console.log('Received booking_request event with data:', data);
    
    // Handle reliable socket message format and send ACK if required
    let bookingData = data;
    if (data.meta && data.payload) {
      // This is a reliable socket message, extract the actual booking data
      bookingData = data.payload;
      console.log('📨 [listenForBookingRequests] Processing reliable socket message:', data.meta.messageId);
      
      // Send ACK if required
      if (data.meta.requiresAck && data.meta.messageId) {
        console.log(`✅ [listenForBookingRequests] Sending ACK for message ${data.meta.messageId}`);
        socket.emit('ack', {
          messageId: data.meta.messageId,
          status: 'received',
          timestamp: new Date().toISOString(),
          clientType: 'astrologer-app'
        });
      }
    }
    
    // Call the callback with the booking data
    onBookingRequest(bookingData);
  };
  
  // Register event listener
  socket.on('booking_request', bookingRequestHandler);
  
  // Return cleanup function
  return () => {
    console.log('Removing event listener for "booking_request"');
    socket.off('booking_request', bookingRequestHandler);
  };
};

/**
 * Join a consultation room
 * @param {Object} socket - Socket.io instance
 * @param {String} bookingId - Booking ID
 * @param {String} roomId - Room ID
 * @returns {Promise<Object>} - Promise that resolves with response
 */
export const joinConsultationRoom = (socket, bookingId, roomId) => {
  if (!socket || !socket.connected) {
    return Promise.reject(new Error('Socket not connected'));
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Join room timeout'));
    }, RESPONSE_TIMEOUT);
    
    socket.emit('join_consultation_room', { bookingId, roomId }, (response) => {
      clearTimeout(timeout);
      
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response ? response.message : 'Failed to join consultation room'));
      }
    });
  });
};

/**
 * Leave a consultation room
 * @param {Object} socket - Socket.io instance
 * @param {String} bookingId - Booking ID
 * @param {String} roomId - Room ID
 * @returns {Promise<void>}
 */
export const leaveConsultationRoom = (socket, bookingId, roomId) => {
  if (!socket || !socket.connected) {
    return Promise.reject(new Error('Socket not connected'));
  }
  
  return new Promise((resolve) => {
    socket.emit('leave_consultation_room', { bookingId, roomId }, () => {
      resolve();
    });
    
    // Resolve after a short timeout even if no acknowledgement
    setTimeout(resolve, 1000);
  });
};

/**
 * Listen for participant join/leave events
 * @param {Object} socket - Socket.io instance
 * @param {Function} onParticipantJoined - Callback when participant joins
 * @param {Function} onParticipantLeft - Callback when participant leaves
 * @returns {Function} - Cleanup function to remove listeners
 */
export const listenForParticipantEvents = (socket, onParticipantJoined, onParticipantLeft) => {
  if (!socket || !socket.connected) {
    console.error('listenForParticipantEvents: Socket not connected');
    return () => {};
  }
  
  socket.on('participant_joined', onParticipantJoined);
  socket.on('participant_left', onParticipantLeft);
  
  return () => {
    socket.off('participant_joined', onParticipantJoined);
    socket.off('participant_left', onParticipantLeft);
  };
};

/**
 * Listen for consultation timer updates
 * @param {Object} socket - Socket.io instance
 * @param {Function} onTimerUpdate - Callback for timer updates
 * @returns {Function} - Cleanup function to remove listener
 */
export const listenForTimerUpdates = (socket, onTimerUpdate) => {
  if (!socket || !socket.connected) {
    console.error('listenForTimerUpdates: Socket not connected');
    return () => {};
  }
  
  socket.on('session_timer', onTimerUpdate);
  
  return () => {
    socket.off('session_timer', onTimerUpdate);
  };
};

/**
 * Listen for consultation status updates
 * @param {Object} socket - Socket.io instance
 * @param {Function} onStatusUpdate - Callback for status updates
 * @returns {Function} - Cleanup function to remove listener
 */
export const listenForStatusUpdates = (socket, onStatusUpdate) => {
  if (!socket || !socket.connected) {
    console.error('listenForStatusUpdates: Socket not connected');
    return () => {};
  }
  
  socket.on('session_status', onStatusUpdate);
  
  return () => {
    socket.off('session_status', onStatusUpdate);
  };
};

/**
 * Send a chat message
 * @param {Object} socket - Socket.io instance
 * @param {string} bookingId - Booking ID
 * @param {string} text - Message text
 * @param {string} senderId - Sender ID
 * @param {string} senderName - Sender name
 * @param {string} messageId - Message ID for tracking read receipts
 * @returns {Promise<Object>} - Promise resolving to message object
 */
export const sendChatMessage = (socket, bookingId, text, senderId, senderName, messageId) => {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      console.error('sendChatMessage: Socket not connected');
      reject(new Error('Socket not connected'));
      return;
    }
    
    try {
      // Ensure we have a valid messageId
      if (!messageId) {
        console.error('Missing messageId when sending message');
        messageId = Date.now().toString();
      }
      
      // Create message payload
      const messagePayload = {
        roomId: bookingId,
        content: text,
        senderId,
        senderName,
        messageId, // Include messageId for tracking read receipts
        id: messageId, // IMPORTANT: Also include as 'id' to ensure consistency
        timestamp: new Date().toISOString()
      };
      
      // Send message to server
      socket.emit('send_message', messagePayload, (response) => {
        if (response && response.success) {
          // Message sent successfully
          resolve(response.message);
        } else {
          reject(new Error(response?.message || 'Failed to send message'));
        }
      });
    } catch (error) {
      console.error('Error in sendChatMessage:', error);
      reject(error);
    }
  });
};

/**
 * Listen for chat messages in a consultation
 * @param {Object} socket - Socket.io instance
 * @param {Function} onChatMessage - Callback for new messages
 * @returns {Function} - Cleanup function to remove listener
 */
export const listenForChatMessages = (socket, onChatMessage) => {
  if (!socket || !socket.connected) {
    console.error('listenForChatMessages: Socket not connected');
    return () => {};
  }
  
  // Listen for receive_message event from server and transform payload to expected format
  const messageHandler = (serverMessage) => {
    // Ensure message has an ID to maintain consistency across apps
    if (!serverMessage.id) {
      console.error('Received message without ID');
    }
    
    // Transform server message format to client format
    const clientMessage = {
      id: serverMessage.id, // Always use the original ID, no fallback to ensure consistency
      senderId: serverMessage.sender,
      senderName: serverMessage.senderRole === 'user' ? 'User' : 'Astrologer',
      text: serverMessage.content,
      timestamp: serverMessage.timestamp || new Date().toISOString(),
      bookingId: serverMessage.roomId
    };
    
    console.log('[ASTROLOGER-APP socketService] Transformed message with ID:', clientMessage.id);
    onChatMessage(clientMessage);
  };
  
  socket.on('receive_message', messageHandler);
  
  return () => {
    socket.off('receive_message', messageHandler);
  };
};

/**
 * Send typing indicator status
 * @param {Object} socket - Socket.io instance
 * @param {String} bookingId - Booking ID (room ID)
 * @param {Boolean} isTyping - Whether the user is typing or stopped typing
 * @returns {Promise<void>}
 */
export const sendTypingStatus = (socket, bookingId, isTyping) => {
  if (!socket || !socket.connected) {
    console.error('[ASTROLOGER-APP] Socket not connected for typing status');
    return Promise.reject(new Error('Socket not connected'));
  }
  
  const eventName = isTyping ? 'typing_started' : 'typing_stopped';
  
  // Enhanced payload with more complete information
  const payload = {
    bookingId,
    roomId: bookingId,  // Include roomId as some server implementations might expect this
    userId: 'astrologer',
    senderRole: 'astrologer'
  };
  
  console.log(`[ASTROLOGER-APP] Emitting ${eventName} event with payload:`, payload);
  
  return new Promise((resolve) => {
    socket.emit(eventName, payload);
    resolve();
  });
};

/**
 * Listen for typing status changes
 * @param {Object} socket - Socket.io instance
 * @param {Function} onTypingStarted - Callback when typing starts
 * @param {Function} onTypingStopped - Callback when typing stops
 * @returns {Function} - Cleanup function to remove listeners
 */
export const listenForTypingStatus = (socket, onTypingStarted, onTypingStopped) => {
  if (!socket || !socket.connected) {
    console.error('[ASTROLOGER-APP] listenForTypingStatus: Socket not connected');
    return () => {};
  }
  
  // Wrap the callbacks with logging
  const typingStartedHandler = (data) => {
    console.log('[ASTROLOGER-APP] Received typing_started event:', data);
    onTypingStarted(data);
  };
  
  const typingStoppedHandler = (data) => {
    console.log('[ASTROLOGER-APP] Received typing_stopped event:', data);
    onTypingStopped(data);
  };
  
  console.log('[ASTROLOGER-APP] Setting up typing status listeners');
  socket.on('typing_started', typingStartedHandler);
  socket.on('typing_stopped', typingStoppedHandler);
  
  return () => {
    console.log('[ASTROLOGER-APP] Removing typing status listeners');
    socket.off('typing_started', typingStartedHandler);
    socket.off('typing_stopped', typingStoppedHandler);
  };
};

/**
 * Mark a message as read
 * @param {Object} socket - Socket.io instance
 * @param {String} bookingId - Booking ID (room ID)
 * @param {String} messageId - ID of the message that was read
 * @returns {Promise<void>}
 */
export const markMessageAsRead = (socket, bookingId, messageId) => {
  if (!socket || !socket.connected) {
    return Promise.reject(new Error('Socket not connected'));
  }
  
  return new Promise((resolve) => {
    socket.emit('message_read', { bookingId, messageId });
    resolve();
  });
};

/**
 * Listen for message status updates (read receipts)
 * @param {Object} socket - Socket.io instance
 * @param {Function} onMessageStatusUpdate - Callback for status updates
 * @returns {Function} - Cleanup function to remove listener
 */
export const listenForMessageStatusUpdates = (socket, onMessageStatusUpdate) => {
  if (!socket || !socket.connected) {
    console.error('listenForMessageStatusUpdates: Socket not connected');
    return () => {};
  }
  
  socket.on('message_status_update', onMessageStatusUpdate);
  
  return () => {
    socket.off('message_status_update', onMessageStatusUpdate);
  };
};

/**
 * Set up ACK handler for reliable socket notifications
 * @param {Object} socket - Socket.io instance
 */
export const setupAckHandler = (socket) => {
  if (!socket || !socket.connected) {
    console.warn('⚠️ [socketService] Cannot setup ACK handler - socket not connected');
    return;
  }
  
  // Listen for messages that require acknowledgement
  const handleReliableMessage = (event, data) => {
    console.log(`📨 [socketService] Received reliable message on event '${event}':`, data);
    
    // Check if message requires acknowledgement
    if (data.meta && data.meta.requiresAck && data.meta.messageId) {
      console.log(`✅ [socketService] Sending ACK for message ${data.meta.messageId}`);
      
      // Send acknowledgement back to server
      socket.emit('ack', {
        messageId: data.meta.messageId,
        status: 'received',
        timestamp: new Date().toISOString(),
        clientType: 'astrologer-app'
      });
    }
  };
  
  // Set up listeners for critical events that may require ACK
  // Note: booking_request is handled separately by listenForBookingRequests to avoid conflicts
  const criticalEvents = [
    'booking_status_update', 
    'booking_accepted',
    'booking_rejected',
    'session_started',
    'consultation_ended',
    'astrologer_joined_consultation'
  ];
  
  criticalEvents.forEach(event => {
    socket.on(event, (data) => {
      handleReliableMessage(event, data);
    });
  });
  
  console.log('🔧 [socketService] ACK handler set up for reliable notifications');
};

/**
 * Initialize ACK handling for a socket instance
 * @param {Object} socket - Socket.io instance
 */
export const initializeAckHandling = (socket) => {
  try {
    if (socket && socket.connected) {
      setupAckHandler(socket);
    } else {
      console.warn('⚠️ [socketService] Cannot initialize ACK handling - socket not available or not connected');
    }
  } catch (error) {
    console.error('❌ [socketService] Failed to initialize ACK handling:', error);
  }
};

/**
 * Listen for session join notifications from users
 * @param {Object} socket - Socket.io instance
 * @param {Function} onSessionJoinRequest - Callback for session join requests
 * @returns {Function} - Cleanup function to remove listener
 */
export const listenForSessionJoinNotifications = (socket, onSessionJoinRequest) => {
  if (!socket || !socket.connected) {
    console.warn('Socket not connected for session join notifications');
    return () => {};
  }
  
  console.log('🔔 [SESSION_JOIN] Setting up session join notification listener');
  
  // Listen for user attempting to join session
  const handleUserAttemptingToJoinSession = (data) => {
    console.log('🔔 [SESSION_JOIN] User attempting to join session:', data);
    if (onSessionJoinRequest) {
      onSessionJoinRequest(data);
    }
  };
  
  socket.on('user_attempting_to_join_session', handleUserAttemptingToJoinSession);
  
  // Return cleanup function
  return () => {
    console.log('🔔 [SESSION_JOIN] Cleaning up session join notification listener');
    socket.off('user_attempting_to_join_session', handleUserAttemptingToJoinSession);
  };
};

/**
 * Respond to a session join request from user
 * @param {Object} socket - Socket.io instance
 * @param {String} bookingId - Booking ID
 * @param {Boolean} accepted - Whether to accept or decline the session join
 * @param {String} reason - Optional reason for declining
 * @returns {Promise<Object>} - Promise that resolves with response
 */
export const respondToSessionJoinRequest = async (socket, bookingId, accepted, reason = null) => {
  if (!socket || !socket.connected) {
    return Promise.reject(new Error('Socket not connected'));
  }
  
  console.log('🔔 [SESSION_JOIN] Responding to session join request:', { bookingId, accepted, reason });
  
  return new Promise((resolve, reject) => {
    // Set timeout for response
    const timeout = setTimeout(() => {
      reject(new Error('Response timeout'));
    }, RESPONSE_TIMEOUT);
    
    // Send response
    socket.emit('astrologer_session_join_response', {
      bookingId,
      accepted,
      reason
    }, (response) => {
      clearTimeout(timeout);
      
      if (response && response.success) {
        resolve(response);
      } else {
        console.error('Session join response error:', response);
        reject(new Error(response ? response.message : 'Unknown error'));
      }
    });
  });
};

/**
 * Get current pending free chat requests for the astrologer
 * @param {Object} socket - Socket.io instance
 * @returns {Promise<Array>} - Promise that resolves with pending free chat requests array
 */
export const getPendingFreeChatRequests = async (socket) => {
  console.log('🆓 [CLIENT] getPendingFreeChatRequests called');
  console.log('🆓 [CLIENT] Socket connected:', socket?.connected);
  console.log('🆓 [CLIENT] Socket ID:', socket?.id);
  
  if (!socket || !socket.connected) {
    console.log('🆓 [CLIENT] Socket not connected, rejecting');
    return Promise.reject(new Error('Socket not connected'));
  }
  
  return new Promise((resolve, reject) => {
    console.log('🆓 [CLIENT] Setting up timeout and emitting event');
    
    // Set timeout for response
    const timeout = setTimeout(() => {
      console.log('🆓 [CLIENT] Request timeout after', RESPONSE_TIMEOUT, 'ms');
      reject(new Error('Request timeout'));
    }, RESPONSE_TIMEOUT);
    
    // Listen for response
    console.log('🆓 [CLIENT] Emitting get_pending_free_chats event');
    socket.emit('get_pending_free_chats', {}, (response) => {
      console.log('🆓 [CLIENT] Received response:', response);
      clearTimeout(timeout);
      
      if (response && response.success) {
        console.log('🆓 [CLIENT] Success response with', response.pendingFreeChats?.length || 0, 'free chat requests');
        resolve(response.pendingFreeChats || []);
      } else {
        console.error('🆓 [CLIENT] Get pending free chats error:', response);
        reject(new Error(response ? response.message : 'Unknown error'));
      }
    });
  });
};

/**
 * Get current pending bookings for the astrologer
 * @param {Object} socket - Socket.io instance
 * @returns {Promise<Array>} - Promise that resolves with pending bookings array
 */
export const getPendingBookings = async (socket) => {
  console.log('📋 [CLIENT] getPendingBookings called');
  console.log('📋 [CLIENT] Socket connected:', socket?.connected);
  console.log('📋 [CLIENT] Socket ID:', socket?.id);
  
  if (!socket || !socket.connected) {
    console.log('📋 [CLIENT] Socket not connected, rejecting');
    return Promise.reject(new Error('Socket not connected'));
  }
  
  return new Promise((resolve, reject) => {
    console.log('📋 [CLIENT] Setting up timeout and emitting event');
    
    // Set timeout for response
    const timeout = setTimeout(() => {
      console.log('📋 [CLIENT] Request timeout after', RESPONSE_TIMEOUT, 'ms');
      reject(new Error('Request timeout'));
    }, RESPONSE_TIMEOUT);
    
    // Listen for response
    console.log('📋 [CLIENT] Emitting get_pending_bookings event');
    socket.emit('get_pending_bookings', {}, (response) => {
      console.log('📋 [CLIENT] Received response:', response);
      clearTimeout(timeout);
      
      if (response && response.success) {
        console.log('📋 [CLIENT] Success response with', response.pendingBookings?.length || 0, 'bookings');
        resolve(response.pendingBookings || []);
      } else {
        console.error('📋 [CLIENT] Get pending bookings error:', response);
        reject(new Error(response ? response.message : 'Unknown error'));
      }
    });
  });
};

/**
 * Listen for real-time pending booking updates
 * @param {Object} socket - Socket.io instance
 * @param {Function} onPendingBookingsUpdated - Callback for pending bookings updates
 * @returns {Function} - Cleanup function to remove listener
 */
export const listenForPendingBookingUpdates = (socket, onPendingBookingsUpdated) => {
  if (!socket) {
    console.warn('Socket not available for pending booking updates listener');
    return () => {};
  }
  
  const handlePendingBookingsUpdated = (data) => {
    console.log('📋 [SOCKET] Received pending bookings update:', data);
    if (onPendingBookingsUpdated && typeof onPendingBookingsUpdated === 'function') {
      onPendingBookingsUpdated(data.pendingBookings || []);
    }
  };
  
  // Listen for pending bookings updates
  socket.on('pending_bookings_updated', handlePendingBookingsUpdated);
  
  console.log('📋 [SOCKET] Listening for pending booking updates');
  
  // Return cleanup function
  return () => {
    socket.off('pending_bookings_updated', handlePendingBookingsUpdated);
    console.log('📋 [SOCKET] Stopped listening for pending booking updates');
  };
};

// Export all functions as a default object for convenience
export default {
  respondToBookingRequest,
  listenForBookingRequests,
  joinConsultationRoom,
  leaveConsultationRoom,
  listenForParticipantEvents,
  listenForTimerUpdates,
  listenForStatusUpdates,
  sendChatMessage,
  listenForChatMessages,
  sendTypingStatus,
  listenForTypingStatus,
  markMessageAsRead,
  listenForMessageStatusUpdates,
  setupAckHandler,
  initializeAckHandling,
  getPendingBookings,
  getPendingFreeChatRequests,
  listenForPendingBookingUpdates,
  listenForSessionJoinNotifications,
  respondToSessionJoinRequest
};
