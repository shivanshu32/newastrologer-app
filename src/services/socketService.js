/**
 * Socket Service - Stateless utility functions for socket operations
 * 
 * This service has been refactored to be stateless. All functions now accept
 * a socket instance as an argument instead of using a global socket.
 * 
 * Socket initialization and management is now handled by SocketContext.
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
  
  // Create a wrapper function to log the event when received
  const bookingRequestHandler = (data) => {
    console.log('Received new_booking_request event with data:', data);
    onBookingRequest(data);
  };
  
  // Register event listener
  socket.on('new_booking_request', bookingRequestHandler);
  
  // Return cleanup function
  return () => {
    console.log('Removing event listener for "new_booking_request"');
    socket.off('new_booking_request', bookingRequestHandler);
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
 * Send a chat message in a consultation
 * @param {Object} socket - Socket.io instance
 * @param {String} roomId - Room ID
 * @param {String} message - Message content
 * @param {String} messageType - Message type (text, image, etc.)
 * @returns {Promise<Object>} - Promise that resolves with response
 */
export const sendChatMessage = (socket, roomId, message, messageType = 'text') => {
  if (!socket || !socket.connected) {
    return Promise.reject(new Error('Socket not connected'));
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Send message timeout'));
    }, RESPONSE_TIMEOUT);
    
    const messageData = {
      roomId,
      content: message,
      type: messageType,
      timestamp: new Date().toISOString()
    };
    
    socket.emit('send_message', messageData, (response) => {
      clearTimeout(timeout);
      
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error(response ? response.message : 'Failed to send message'));
      }
    });
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
  
  socket.on('receive_message', onChatMessage);
  
  return () => {
    socket.off('receive_message', onChatMessage);
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
  listenForChatMessages
};
