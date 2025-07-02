import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  BackHandler, 
  Alert, 
  ActivityIndicator,
  Text,
  SafeAreaView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

const VoiceCallScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { socket } = useSocket();
  const { user } = useAuth();
  const webViewRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [sessionInfo, setSessionInfo] = useState({
    duration: 0,
    currentAmount: 0
  });
  const [webRTCConnectionState, setWebRTCConnectionState] = useState('new');
  const [webRTCIceState, setWebRTCIceState] = useState('new');
  const [webRTCLogs, setWebRTCLogs] = useState([]);
  const [isLocalWebRTCConnected, setIsLocalWebRTCConnected] = useState(false);
  const [isRemoteWebRTCReadyForTimer, setIsRemoteWebRTCReadyForTimer] = useState(false);
  const [userIdToCall, setUserIdToCall] = useState(null);
  const [hasEmittedStartVoiceCall, setHasEmittedStartVoiceCall] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [isUserJoined, setIsUserJoined] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [isTimerStarted, setIsTimerStarted] = useState(false);

  // Get booking details from route params
  const { bookingId, sessionId, roomId, bookingDetails } = route.params || {};

  // Define handleUserJoinedConsultation function outside useEffect so it's available early
  const handleUserJoinedConsultation = (data) => {
    try {
      console.log(' [ASTROLOGER-APP] handleUserJoinedConsultation ENTRY - data:', JSON.stringify(data));
      console.log(' [ASTROLOGER-APP] Current booking ID:', bookingId);
      console.log(' [ASTROLOGER-APP] Current booking details:', JSON.stringify(route.params?.booking));
      
      // Determine the consultation type from multiple possible sources
      const consultationType = data.consultationType || data.type || 
                            (data.bookingDetails && data.bookingDetails.type) || 
                            route.params?.booking?.type;
      
      console.log(' [ASTROLOGER-APP] data.type:', data.type);
      console.log(' [ASTROLOGER-APP] data.consultationType:', data.consultationType);
      console.log(' [ASTROLOGER-APP] bookingDetails.type:', data.bookingDetails?.type);
      console.log(' [ASTROLOGER-APP] Final determined consultation type:', consultationType);
      
      // Check if this is a voice consultation
      const isVideoCall = consultationType === 'video';
      const isVoiceCall = consultationType === 'voice';
      
      console.log(' [ASTROLOGER-APP] Is video call?', isVideoCall);
      console.log(' [ASTROLOGER-APP] Is voice call?', isVoiceCall);
      
      if (isVoiceCall) {
        console.log(' [ASTROLOGER-APP] Voice consultation detected, preparing to set user joined');
        
        // Extract user ID from the data payload
        const userId = data.userId;
        console.log(' [ASTROLOGER-APP] User ID to call:', userId);
        
        if (userId) {
          // Store the userId for later use if needed
          console.log(' [ASTROLOGER-APP] Setting userIdToCall and isUserJoined to true');
          setUserIdToCall(userId);
          setIsUserJoined(true);
          console.log(' [ASTROLOGER-APP] Successfully set isUserJoined=true and userIdToCall=', userId);
        } else {
          console.error(' [ASTROLOGER-APP] Cannot set user joined - missing userId in user_joined_consultation data');
        }
      } else {
        console.log(' [ASTROLOGER-APP] Not a voice consultation, ignoring event. Data type:', consultationType);
      }
      
      console.log(' [ASTROLOGER-APP] handleUserJoinedConsultation COMPLETED successfully');
    } catch (error) {
      console.error(' [ASTROLOGER-APP] ERROR in handleUserJoinedConsultation:', error);
      console.error(' [ASTROLOGER-APP] Error stack:', error.stack);
    }
  };

  // Load HTML content from file
  useEffect(() => {
    const loadHtmlFile = async () => {
      try {
        console.log('[ASTROLOGER-APP] Starting to load voice-webrtc.html');
        
        // Download the asset first
        const asset = Asset.fromModule(require('../assets/voice-webrtc.html'));
        await asset.downloadAsync();
        
        // Read the HTML content
        const htmlContent = await FileSystem.readAsStringAsync(asset.localUri);
        
        console.log('[ASTROLOGER-APP] Voice HTML content loaded successfully, length:', htmlContent.length);
        
        setHtmlContent(htmlContent);
        setLoading(false);
      } catch (error) {
        console.error('[ASTROLOGER-APP] Error loading voice-webrtc.html:', error);
        setError('Failed to load voice call interface');
        setLoading(false);
      }
    };

    loadHtmlFile();
    
    // Check if we have user join data passed from WaitingRoomScreen
    const userJoinData = route.params?.userJoinData;
    if (userJoinData) {
      console.log(' [ASTROLOGER-APP] Found userJoinData in navigation params:', JSON.stringify(userJoinData));
      // Process the user join data immediately
      handleUserJoinedConsultation(userJoinData);
    } else {
      console.log(' [ASTROLOGER-APP] No userJoinData found in navigation params, will wait for socket events');
    }

    return () => {
      console.log('[ASTROLOGER-APP] VoiceCallScreen unmounting, cleaning up socket listeners');
      if (socket) {
        socket.off('voice_call_offer');
        socket.off('voice_call_answer');
        socket.off('voice_ice_candidate');
        socket.off('start_voice_call');
        socket.off('user_joined_consultation');
        socket.off('webrtc_client_ready_for_timer');
        socket.off('ice_restart_initiated');
      }
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleVoiceCallOffer = (data) => {
      console.log('[ASTROLOGER-APP] Received voice call offer:', data);
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'voice_call_offer',
          data: data
        }));
      }
    };

    const handleVoiceCallAnswer = (data) => {
      console.log('[ASTROLOGER-APP] Received voice call answer:', data);
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'voice_call_answer',
          data: data
        }));
      }
    };

    const handleVoiceIceCandidate = (data) => {
      console.log('[ASTROLOGER-APP] Received voice ICE candidate:', data);
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'voice_ice_candidate',
          data: data
        }));
      }
    };

    const handleStartVoiceCall = (data) => {
      console.log('[ASTROLOGER-APP] Start voice call event received:', data);
      // User has joined, we can now start the WebRTC connection
      if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'participant_info',
          data: {
            participantName: data.userName || 'User',
            participantType: 'user'
          }
        }));
      }
    };

    // Handle when the other client is ready for timer
    const handleWebRTCClientReadyForTimer = (data) => {
      console.log('[ASTROLOGER-APP] Remote client is ready for timer:', data);
      if (data && data.bookingId === bookingId) {
        setIsRemoteWebRTCReadyForTimer(true);
      }
    };

    // Add socket listeners with debug logging
    console.log('[ASTROLOGER-APP] Setting up socket listeners for voice call events');
    
    socket.on('voice_call_offer', handleVoiceCallOffer);
    socket.on('voice_call_answer', handleVoiceCallAnswer);
    socket.on('voice_ice_candidate', handleVoiceIceCandidate);
    socket.on('start_voice_call', handleStartVoiceCall);
    
    console.log('[ASTROLOGER-APP] Setting up socket listener for "user_joined_consultation"');
    socket.on('user_joined_consultation', (data) => {
      console.log(' [ASTROLOGER-APP] Received "user_joined_consultation" event with data:', JSON.stringify(data));
      
      // Check if this event is for our current booking
      if (data.bookingId === bookingId) {
        console.log(' [ASTROLOGER-APP] Expected bookingId:', bookingId);
        console.log(' [ASTROLOGER-APP] Received bookingId:', data.bookingId);
        console.log(' [ASTROLOGER-APP] BookingId matches, calling handleUserJoined');
        handleUserJoinedConsultation(data);
      } else {
        console.log(' [ASTROLOGER-APP] BookingId mismatch, ignoring event');
      }
    });
    
    socket.on('webrtc_client_ready_for_timer', handleWebRTCClientReadyForTimer);
    
    // Handle ICE connection failure notification from user app
    const handleIceConnectionFailed = (data) => {
      console.log('[ASTROLOGER-APP] Received ice_connection_failed event:', data);
      
      // Verify this is for our current call
      if (data.bookingId === bookingId) {
        console.log('[ASTROLOGER-APP] ICE connection failed on user side, attempting to restart ICE');
        
        // Instruct WebView to restart ICE
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({
            type: 'restart_ice'
          }));
          
          // Also notify user app that we're trying to restart
          if (socket && socket.connected) {
            socket.emit('ice_restart_initiated', {
              bookingId: bookingId,
              sessionId: sessionId,
              roomId: roomId,
              fromAstrologer: true,
              to: 'user'
            });
          }
        }
      }
    };
    
    socket.on('ice_connection_failed', handleIceConnectionFailed);

    // Cleanup listeners
    return () => {
      socket.off('voice_call_offer', handleVoiceCallOffer);
      socket.off('voice_call_answer', handleVoiceCallAnswer);
      socket.off('voice_ice_candidate', handleVoiceIceCandidate);
      socket.off('start_voice_call', handleStartVoiceCall);
      socket.off('user_joined_consultation', handleUserJoinedConsultation);
      socket.off('webrtc_client_ready_for_timer', handleWebRTCClientReadyForTimer);
      socket.off('ice_connection_failed', handleIceConnectionFailed);
    };
  }, [socket, bookingId, sessionId, roomId, user]);

  // Track WebRTC connection state changes
  useEffect(() => {
    if (webRTCIceState === 'failed') {
      console.error('[ASTROLOGER-APP] WebRTC ICE connection failed');
      setError('WebRTC connection failed. Please check your network connection and try again.');
      
      // Try to restart ICE
      if (webViewRef.current) {
        console.log('[ASTROLOGER-APP] Attempting to restart ICE connection');
        webViewRef.current.postMessage(JSON.stringify({
          type: 'restart_ice'
        }));
      }
    } else if (webRTCIceState === 'checking' && webRTCConnectionState === 'connected') {
      // This is a special case where ICE is still checking but the connection is established
      // This can happen in some WebRTC implementations and might be recoverable
      console.log('[ASTROLOGER-APP] WebRTC connection is established but ICE is still checking');
      
      // Set a timeout to check if ICE remains in checking state
      const iceCheckingTimeout = setTimeout(() => {
        if (webRTCIceState === 'checking') {
          console.log('[ASTROLOGER-APP] ICE still in checking state after timeout, attempting restart');
          if (webViewRef.current) {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'restart_ice'
            }));
          }
        }
      }, 10000); // 10 seconds
      
      return () => clearTimeout(iceCheckingTimeout);
    } else if (webRTCIceState === 'connected' || webRTCIceState === 'completed') {
      console.log('[ASTROLOGER-APP] WebRTC ICE connection established');
      setError(null);
    }
  }, [webRTCIceState, webRTCConnectionState]);

  // Track socket connection state
  useEffect(() => {
    if (socket) {
      const checkSocketConnection = () => {
        const isConnected = socket.connected;
        console.log('[ASTROLOGER-APP] Socket connection status check:', isConnected);
        setSocketReady(isConnected);
        return isConnected;
      };
      
      // Check initial connection state
      const initiallyConnected = checkSocketConnection();
      
      // If not connected initially, set up a listener for the connect event
      if (!initiallyConnected) {
        console.log('[ASTROLOGER-APP] Socket not initially connected, setting up connect listener');
        
        const handleConnect = () => {
          console.log('[ASTROLOGER-APP] Socket connected event fired');
          setSocketReady(true);
        };
        
        socket.on('connect', handleConnect);
        
        // Cleanup
        return () => {
          socket.off('connect', handleConnect);
        };
      }
    } else {
      console.log('[ASTROLOGER-APP] No socket instance available yet');
      setSocketReady(false);
    }
  }, [socket]);

  // Join consultation room when component mounts AND socket is ready
  useEffect(() => {
    // Only proceed if socket is ready and we have all required data
    if (socketReady && socket && bookingId && roomId) {
      console.log('[ASTROLOGER-APP] Socket is ready! Joining consultation room');
      console.log('[ASTROLOGER-APP] Room details:', { bookingId, roomId, socketConnected: socket.connected });
      
      socket.emit('join_consultation_room', { bookingId }, (response) => {
        console.log('[ASTROLOGER-APP] join_consultation_room response:', response);
        
        if (response && response.success) {
          console.log(`[ASTROLOGER-APP] Successfully joined consultation room for booking: ${bookingId}`);
        } else {
          console.error('[ASTROLOGER-APP] Failed to join consultation room:', response?.error || 'Unknown error');
          console.error('[ASTROLOGER-APP] This may prevent receiving user_joined_consultation events');
        }
      });

      // Add a timeout to detect if the callback never fires
      setTimeout(() => {
        console.log('[ASTROLOGER-APP] join_consultation_room timeout check - if no response logged above, the server may not be responding');
      }, 5000);
    } else {
      console.log('[ASTROLOGER-APP] Waiting for socket to be ready or missing required data:', {
        bookingId,
        roomId,
        socketConnected: socket?.connected
      });
    }
  }, [socketReady, socket, bookingId, roomId]);

  // CRITICAL: Emit start_voice_call when both conditions are met
  useEffect(() => {
    if (isUserJoined && isWebViewReady && socket && socket.connected && !hasEmittedStartVoiceCall) {
      console.log(' [ASTROLOGER-APP] Both conditions met - emitting start_voice_call');
      console.log(' [ASTROLOGER-APP] isUserJoined:', isUserJoined);
      console.log(' [ASTROLOGER-APP] isWebViewReady:', isWebViewReady);
      console.log(' [ASTROLOGER-APP] socket.connected:', socket.connected);
      console.log(' [ASTROLOGER-APP] socket.id:', socket.id);
      console.log(' [ASTROLOGER-APP] hasEmittedStartVoiceCall:', hasEmittedStartVoiceCall);
      
      const startVoiceCallData = {
        bookingId: bookingId,
        sessionId: sessionId,
        roomId: roomId,
        astrologerId: user?.id,
        userId: userIdToCall,
        type: 'voice',
        timestamp: new Date().toISOString()
      };
      
      console.log(' [ASTROLOGER-APP] Emitting start_voice_call with data:', JSON.stringify(startVoiceCallData));
      console.log(' [ASTROLOGER-APP] Socket status before emission - connected:', socket.connected, 'id:', socket.id);
      
      try {
        socket.emit('start_voice_call', startVoiceCallData, (response) => {
          console.log(' [ASTROLOGER-APP] start_voice_call emission callback response:', response);
        });
        setHasEmittedStartVoiceCall(true);
        console.log(' [ASTROLOGER-APP] start_voice_call emitted successfully');
      } catch (error) {
        console.error(' [ASTROLOGER-APP] Error emitting start_voice_call:', error);
      }
    } else {
      console.log(' [ASTROLOGER-APP] Waiting for conditions to emit start_voice_call:', {
        isUserJoined,
        isWebViewReady,
        socketConnected: socket?.connected,
        socketId: socket?.id,
        hasEmittedStartVoiceCall,
        userIdToCall
      });
    }
  }, [isUserJoined, isWebViewReady, socket, hasEmittedStartVoiceCall, bookingId, sessionId, roomId, user?.id, userIdToCall]);

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[ASTROLOGER-APP] WebView message:', message);

      switch (message.type) {
        case 'webrtc_log':
          // Store WebRTC logs for debugging
          const newLog = {
            level: message.data.level,
            message: message.data.message,
            timestamp: new Date().toISOString()
          };
          console.log(`[ASTROLOGER-APP] WebRTC Log (${newLog.level}): ${newLog.message}`);
          setWebRTCLogs(prevLogs => [...prevLogs, newLog].slice(-100)); // Keep last 100 logs
          break;
          
        case 'webrtc_connection_state':
          console.log('[ASTROLOGER-APP] WebRTC connection state changed:', message.data.state);
          setWebRTCConnectionState(message.data.state);
          break;
          
        case 'webrtc_ice_state':
          console.log('[ASTROLOGER-APP] WebRTC ICE state changed:', message.data.state);
          setWebRTCIceState(message.data.state);
          break;
          
        case 'webrtc_error':
          console.error('[ASTROLOGER-APP] WebRTC error:', message.data.error);
          Alert.alert('WebRTC Error', `Connection error: ${message.data.error}`);
          break;
          
        case 'webrtc_ready':
          console.log('[ASTROLOGER-APP] WebRTC is ready');
          setIsWebViewReady(true);
          break;
          
        case 'webrtc_local_connection_established':
          console.log('[ASTROLOGER-APP] WebRTC connected:', message.data);
          setIsLocalWebRTCConnected(true);
          
          // Notify other client that we're ready for timer
          if (socket && socket.connected) {
            console.log('[ASTROLOGER-APP] Emitting webrtc_client_ready_for_timer');
            socket.emit('webrtc_client_ready_for_timer', {
              bookingId: bookingId,
              sessionId: sessionId,
              roomId: roomId,
              fromAstrologer: true
            });
          }
          break;
          
        case 'webrtc_error':
          console.error('[ASTROLOGER-APP] WebRTC error:', message.data);
          setError(`WebRTC error: ${message.data.message || 'Unknown error'}`);
          break;
          
        case 'voice_call_offer':
          console.log('[ASTROLOGER-APP] Voice call offer from WebView:', message.data);
          if (socket && socket.connected) {
            socket.emit('voice_call_offer', {
              ...message.data,
              bookingId: bookingId,
              sessionId: sessionId,
              roomId: roomId,
              fromAstrologer: true
            });
          } else {
            console.error('[ASTROLOGER-APP] Cannot send voice call offer - socket not connected');
          }
          break;
          
        case 'voice_call_answer':
          console.log('[ASTROLOGER-APP] Voice call answer from WebView:', message.data);
          if (socket && socket.connected) {
            socket.emit('voice_call_answer', {
              signal: message.data, // Wrap the WebRTC data in a signal field
              bookingId: bookingId,
              sessionId: sessionId,
              roomId: roomId,
              fromAstrologer: true,
              to: 'user' // Add routing information for backend
            });
          } else {
            console.error('[ASTROLOGER-APP] Cannot send voice call answer - socket not connected');
          }
          break;
          
        case 'voice_ice_candidate':
          console.log('[ASTROLOGER-APP] Voice ICE candidate from WebView:', message.data);
          if (socket && socket.connected) {
            socket.emit('voice_ice_candidate', {
              signal: message.data, // Wrap the WebRTC data in a signal field
              bookingId: bookingId,
              sessionId: sessionId,
              roomId: roomId,
              fromAstrologer: true,
              to: 'user' // Add routing information for backend
            });
          } else {
            console.error('[ASTROLOGER-APP] Cannot send voice ICE candidate - socket not connected');
          }
          break;

        case 'timer_update':
          setSessionInfo(prev => ({
            ...prev,
            duration: message.data.duration
          }));
          break;

        case 'call_ended':
          handleCallEnd(message.data.reason);
          break;

        case 'webrtc_ready':
          console.log('[ASTROLOGER-APP] Voice WebRTC is ready');
          break;

        case 'webrtc_error':
          console.error('[ASTROLOGER-APP] Voice WebRTC error:', message.data.error);
          Alert.alert('Voice Call Error', message.data.error);
          break;

        case 'log':
          // Handle logging from WebView
          break;

        default:
          console.log('[ASTROLOGER-APP] Unknown WebView message type:', message.type);
      }
    } catch (error) {
      console.error('[ASTROLOGER-APP] Error parsing WebView message:', error);
    }
  };

  // Handle call end
  const handleCallEnd = (reason) => {
    console.log('[ASTROLOGER-APP] Voice call ended, reason:', reason);
    
    // Emit call ended event
    socket.emit('voice_call_ended', {
      bookingId: bookingId,
      sessionId: sessionId,
      roomId: roomId,
      duration: sessionInfo.duration,
      endedBy: 'astrologer',
      reason: reason
    });

    // Navigate to Home screen after session end
    navigation.navigate('Home');
  };

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'End Voice Call',
        'Are you sure you want to end the voice call?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'End Call', 
            style: 'destructive',
            onPress: () => handleCallEnd('astrologer_ended')
          }
        ]
      );
      return true;
    });

    return () => backHandler.remove();
  }, [sessionInfo.duration]);
  
  // Effect to start timer when both sides are ready
  useEffect(() => {
    if (isLocalWebRTCConnected && isRemoteWebRTCReadyForTimer && !isTimerStarted && webViewRef.current) {
      console.log('[ASTROLOGER-APP] Both clients ready, starting timer');
      
      // Tell the WebView to start the timer
      webViewRef.current.postMessage(JSON.stringify({
        type: 'start_the_timer'
      }));
      
      setIsTimerStarted(true);
    }
  }, [isLocalWebRTCConnected, isRemoteWebRTCReadyForTimer, isTimerStarted, webViewRef]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading Voice Call...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Voice Consultation</Text>
        <Text style={styles.timerText}>
          {Math.floor(sessionInfo.duration / 60)}:{(sessionInfo.duration % 60).toString().padStart(2, '0')}
        </Text>
      </View>
      
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{
            html: htmlContent,
            baseUrl: FileSystem.documentDirectory
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          onMessage={handleWebViewMessage}
          onLoadStart={() => console.log('[ASTROLOGER-APP] WebView load started')}
          onLoadEnd={() => console.log('[ASTROLOGER-APP] WebView load ended')}
          onError={(err) => {
            console.error('[ASTROLOGER-APP] WebView error:', err);
            setError(`WebView error: ${err.nativeEvent.description}`);
          }}
        />
      </View>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isLocalWebRTCConnected ? 'Connected to call' : 'Connecting to call...'}
        </Text>
        <Text style={styles.connectionStateText}>
          Connection: {webRTCConnectionState} | ICE: {webRTCIceState}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  webViewContainer: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center'
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#6200ee'
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  },
  timerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  },
  statusContainer: {
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#ddd'
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 5
  },
  connectionStateText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666'
  }
});

export default VoiceCallScreen;
