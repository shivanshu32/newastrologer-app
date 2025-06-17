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
  const [htmlContent, setHtmlContent] = useState('');
  const [sessionInfo, setSessionInfo] = useState({
    duration: 0,
    currentAmount: 0
  });
  const [isLocalWebRTCConnected, setIsLocalWebRTCConnected] = useState(false);
  const [isRemoteWebRTCReadyForTimer, setIsRemoteWebRTCReadyForTimer] = useState(false);
  const [isTimerStarted, setIsTimerStarted] = useState(false);
  
  // Get booking details from route params
  const { bookingId, sessionId, roomId, bookingDetails } = route.params || {};

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

    const handleUserJoinedConsultation = (data) => {
      console.log('[ASTROLOGER-APP] User joined consultation for voice call:', data);
      console.log('[ASTROLOGER-APP] Current booking details:', { bookingId, sessionId, roomId });
      
      // Check if this is a voice consultation
      if (data.consultationType === 'voice' || data.type === 'voice') {
        console.log('[ASTROLOGER-APP] Voice consultation detected, emitting start_voice_call');
        
        // Emit start_voice_call to signal the user to create an offer
        const startVoiceCallData = {
          bookingId: bookingId,
          sessionId: sessionId,
          roomId: roomId,
          astrologerId: user?.id,
          astrologerName: user?.displayName || user?.name,
          consultationType: 'voice'
        };
        
        console.log('[ASTROLOGER-APP] Emitting start_voice_call with data:', startVoiceCallData);
        socket.emit('start_voice_call', startVoiceCallData);
      } else {
        console.log('[ASTROLOGER-APP] Not a voice consultation, ignoring event. Data:', data);
      }
    };
    
    // Handle when the other client is ready for timer
    const handleWebRTCClientReadyForTimer = (data) => {
      console.log('[ASTROLOGER-APP] Remote client is ready for timer:', data);
      if (data && data.bookingId === bookingId) {
        setIsRemoteWebRTCReadyForTimer(true);
      }
    };

    // Add socket listeners
    socket.on('voice_call_offer', handleVoiceCallOffer);
    socket.on('voice_call_answer', handleVoiceCallAnswer);
    socket.on('voice_ice_candidate', handleVoiceIceCandidate);
    socket.on('start_voice_call', handleStartVoiceCall);
    socket.on('user_joined_consultation', handleUserJoinedConsultation);
    socket.on('webrtc_client_ready_for_timer', handleWebRTCClientReadyForTimer);

    // Cleanup listeners
    return () => {
      socket.off('voice_call_offer', handleVoiceCallOffer);
      socket.off('voice_call_answer', handleVoiceCallAnswer);
      socket.off('voice_ice_candidate', handleVoiceIceCandidate);
      socket.off('start_voice_call', handleStartVoiceCall);
      socket.off('user_joined_consultation', handleUserJoinedConsultation);
      socket.off('webrtc_client_ready_for_timer', handleWebRTCClientReadyForTimer);
    };
  }, [socket, bookingId, sessionId, roomId, user]);

  // Join consultation room when component mounts
  useEffect(() => {
    if (socket && bookingId && roomId) {
      console.log('[ASTROLOGER-APP] Joining consultation room for voice call');
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
      console.error('[ASTROLOGER-APP] Cannot join consultation room - missing required data:', {
        hasSocket: !!socket,
        bookingId,
        roomId,
        socketConnected: socket?.connected
      });
    }
  }, [socket, bookingId, roomId]);

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[ASTROLOGER-APP] WebView message:', message);

      switch (message.type) {
        case 'voice_call_offer':
          // Send offer to user via socket
          socket.emit('voice_call_offer', {
            ...message.data,
            bookingId: bookingId,
            sessionId: sessionId,
            roomId: roomId,
            fromAstrologer: true
          });
          break;

        case 'voice_call_answer':
          // Send answer to user via socket
          socket.emit('voice_call_answer', {
            ...message.data,
            bookingId: bookingId,
            sessionId: sessionId,
            roomId: roomId,
            fromAstrologer: true
          });
          break;

        case 'voice_ice_candidate':
          // Send ICE candidate to user via socket
          socket.emit('voice_ice_candidate', {
            ...message.data,
            bookingId: bookingId,
            sessionId: sessionId,
            roomId: roomId,
            fromAstrologer: true
          });
          break;
          
        case 'webrtc_local_connection_established':
          console.log('[ASTROLOGER-APP] Local WebRTC connection established');
          setIsLocalWebRTCConnected(true);
          
          // Notify the other client that we're ready for timer
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

    // Navigate back with session info
    navigation.goBack();
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
  }, [isLocalWebRTCConnected, isRemoteWebRTCReadyForTimer, isTimerStarted]);

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
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{
          html: htmlContent,
          baseUrl: FileSystem.documentDirectory
        }}
        style={styles.webview}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default VoiceCallScreen;
