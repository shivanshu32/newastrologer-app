import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SocketContext } from '../context/SocketContext';
import { getWebRTCImports, getVectorIconsImport, getWebRTCService } from '../config/expoConfig';

// Conditional imports for Expo Go compatibility
const { RTCView } = getWebRTCImports();
const Icon = getVectorIconsImport('MaterialIcons');
const WebRTCService = getWebRTCService();

const { width, height } = Dimensions.get('window');

const VideoConsultationScreen = ({ route, navigation }) => {
  const { socket } = useContext(SocketContext);
  const { bookingId, sessionId: routeSessionId, roomId: routeRoomId } = route.params || {};
  
  // State management
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('Initializing');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugLogs, setShowDebugLogs] = useState(true);

  // Refs
  const callStartTime = useRef(null);
  const timerInterval = useRef(null);
  
  // Computed values
  const sessionId = routeSessionId || bookingId;
  const roomId = routeRoomId || `consultation:${bookingId}`;
  const astrologerId = socket?.user?.id || socket?.user?._id;

  // Debug logging function
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(`[ASTROLOGER-APP DEBUG] ${logEntry}`);
    
    setDebugLogs(prev => {
      const newLogs = [...prev, { message: logEntry, type, timestamp }];
      return newLogs.slice(-20); // Keep only last 20 logs
    });
  };

  useEffect(() => {
    addDebugLog('🚀 VideoConsultationScreen initialized');
    addDebugLog(`📋 Params: bookingId=${bookingId}, sessionId=${sessionId}, roomId=${roomId}`);
    
    if (!socket) {
      addDebugLog('❌ Socket not available', 'error');
      return;
    }

    if (!bookingId) {
      addDebugLog('❌ BookingId not provided', 'error');
      Alert.alert('Error', 'Booking ID is required');
      navigation.goBack();
      return;
    }

    initializeVideoCall();

    return () => {
      addDebugLog('🧹 Cleaning up VideoConsultationScreen');
      cleanup();
    };
  }, []);

  const initializeVideoCall = async () => {
    try {
      addDebugLog('🔧 Initializing video call...');
      setConnectionState('Setting up camera...');
      
      // Setup socket listeners first
      const cleanup = setupSocketListeners();
      
      // Initialize WebRTC
      await initializeWebRTC();
      
      // Join consultation room
      await joinConsultationRoom();
      
      addDebugLog('✅ Video call initialization complete');
      
    } catch (error) {
      addDebugLog(`❌ Failed to initialize video call: ${error.message}`, 'error');
      setConnectionState('Failed to initialize');
      Alert.alert('Error', 'Failed to initialize video call. Please try again.');
    }
  };

  const initializeWebRTC = async () => {
    try {
      addDebugLog('🎥 Initializing WebRTC service...');
      
      await WebRTCService.createPeerConnection(
        // onRemoteStream callback
        (stream) => {
          addDebugLog('📺 Remote stream received!', 'success');
          setRemoteStream(stream);
          setConnectionState('Connected');
          if (!callStartTime.current) {
            callStartTime.current = Date.now();
            startTimer();
          }
        },
        // onIceCandidate callback
        (candidate) => {
          addDebugLog('🧊 ICE candidate generated, emitting to backend');
          if (socket && socket.connected) {
            socket.emit('signal', {
              sessionId: sessionId,
              signal: {
                type: 'ice-candidate',
                candidate: candidate
              },
              to: 'user',
              bookingId: bookingId
            });
            addDebugLog('✅ ICE candidate emitted successfully');
          } else {
            addDebugLog('❌ Cannot emit ICE candidate - socket not connected', 'error');
          }
        },
        // onConnectionStateChange callback
        (state) => {
          addDebugLog(`🔗 Connection state changed: ${state}`);
          setConnectionState(state);
        }
      );

      addDebugLog('📱 Getting local media stream...');
      const stream = await WebRTCService.getLocalStream();
      setLocalStream(stream);
      addDebugLog('✅ Local stream obtained successfully');
      
    } catch (error) {
      addDebugLog(`❌ WebRTC initialization failed: ${error.message}`, 'error');
      throw error;
    }
  };

  const joinConsultationRoom = async () => {
    if (!socket || !socket.connected) {
      addDebugLog('❌ Socket not connected for joining room', 'error');
      return;
    }

    if (!bookingId) {
      addDebugLog('❌ Cannot join room - bookingId is null', 'error');
      return;
    }

    addDebugLog(`🚪 Joining consultation room: ${roomId}`);
    addDebugLog(`👨‍⚕️ Astrologer ID: ${astrologerId}`);

    try {
      socket.emit('join_consultation_room', { 
        bookingId, 
        roomId: roomId || bookingId, 
        userId: astrologerId,
        userType: 'astrologer',
        sessionId: sessionId || bookingId // Add sessionId to prevent backend from setting it to null
      });

      addDebugLog(`✅ Successfully joined consultation room for booking: ${bookingId}`);
      
    } catch (error) {
      addDebugLog(`❌ Error joining consultation room: ${error.message}`, 'error');
      Alert.alert('Error', 'Failed to join consultation room. Please try again.');
    }
  };

  const setupSocketListeners = () => {
    if (!socket) {
      addDebugLog('❌ Socket not available for listeners', 'error');
      return () => {};
    }

    addDebugLog('🎧 Setting up socket listeners');

    // Handle WebRTC signaling - unified signal event
    const handleSignal = async (data) => {
      addDebugLog(`📡 Received signal: ${JSON.stringify(data)}`);
      
      if (data.sessionId === (sessionId || bookingId)) {
        addDebugLog(`✅ Signal sessionId matches (${data.sessionId}), processing...`);
        addDebugLog(`🔄 Signal type: ${data.signal.type}`);
        
        try {
          switch (data.signal.type) {
            case 'offer':
              addDebugLog('📥 Processing offer from user');
              setConnectionState('Received offer, creating answer...');
              
              await WebRTCService.handleOffer(data.signal);
              addDebugLog('✅ Offer processed, remote description set');
              
              const answer = await WebRTCService.createAnswer();
              addDebugLog('📤 Answer created, emitting to backend');
              
              if (socket && socket.connected) {
                socket.emit('signal', {
                  sessionId: sessionId,
                  signal: answer,
                  to: 'user',
                  bookingId: bookingId
                });
                addDebugLog('✅ Answer emitted successfully');
                setConnectionState('Answer sent, waiting for connection...');
              } else {
                addDebugLog('❌ Cannot emit answer - socket not connected', 'error');
              }
              break;

            case 'answer':
              addDebugLog('📥 Processing answer from user');
              await WebRTCService.handleAnswer(data.signal);
              addDebugLog('✅ Answer processed successfully');
              break;

            case 'ice-candidate':
              addDebugLog('🧊 Processing ICE candidate from user');
              await WebRTCService.handleIceCandidate(data.signal.candidate);
              addDebugLog('✅ ICE candidate processed successfully');
              break;

            default:
              addDebugLog(`⚠️ Unknown signal type: ${data.signal.type}`, 'warning');
          }
        } catch (error) {
          addDebugLog(`❌ Error processing signal: ${error.message}`, 'error');
        }
      } else {
        addDebugLog(`⚠️ Signal sessionId mismatch: received ${data.sessionId}, expected ${sessionId || bookingId}`, 'warning');
      }
    };

    // Handle user joined - this triggers offer creation
    const handleUserJoined = async (data) => {
      addDebugLog(`👤 User joined: ${JSON.stringify(data)}`);
      if (data.sessionId === (sessionId || bookingId)) {
        addDebugLog('✅ User joined our session, creating offer...');
        setConnectionState('User joined, creating offer...');
        
        try {
          const offer = await WebRTCService.createOffer();
          addDebugLog('📤 Offer created, emitting to backend');
          
          if (socket && socket.connected) {
            socket.emit('signal', {
              sessionId: sessionId,
              signal: offer,
              to: 'user',
              bookingId: bookingId
            });
            addDebugLog('✅ Offer emitted successfully');
            setConnectionState('Offer sent, waiting for answer...');
          } else {
            addDebugLog('❌ Cannot emit offer - socket not connected', 'error');
          }
        } catch (error) {
          addDebugLog(`❌ Error creating/sending offer: ${error.message}`, 'error');
        }
      }
    };

    // Handle astrologer joined (for confirmation)
    const handleAstrologerJoined = (data) => {
      addDebugLog(`👨‍⚕️ Astrologer joined confirmation: ${JSON.stringify(data)}`);
    };

    // Register listeners
    socket.on('signal', handleSignal);
    socket.on('user_joined_consultation', handleUserJoined);
    socket.on('astrologer_joined_consultation', handleAstrologerJoined);

    addDebugLog('✅ Socket listeners registered successfully');

    // Return cleanup function
    return () => {
      addDebugLog('🧹 Cleaning up socket listeners');
      socket.off('signal', handleSignal);
      socket.off('user_joined_consultation', handleUserJoined);
      socket.off('astrologer_joined_consultation', handleAstrologerJoined);
    };
  };

  const startTimer = () => {
    timerInterval.current = setInterval(() => {
      if (callStartTime.current) {
        const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
        setCallDuration(elapsed);
      }
    }, 1000);
  };

  const cleanup = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    WebRTCService.cleanup();
    setLocalStream(null);
    setRemoteStream(null);
  };

  const toggleAudio = async () => {
    try {
      await WebRTCService.toggleAudio();
      setIsAudioMuted(!isAudioMuted);
    } catch (error) {
      addDebugLog(`❌ Error toggling audio: ${error.message}`, 'error');
    }
  };

  const toggleVideo = async () => {
    try {
      await WebRTCService.toggleVideo();
      setIsVideoMuted(!isVideoMuted);
    } catch (error) {
      addDebugLog(`❌ Error toggling video: ${error.message}`, 'error');
    }
  };

  const switchCamera = async () => {
    try {
      await WebRTCService.switchCamera();
      setIsFrontCamera(!isFrontCamera);
    } catch (error) {
      addDebugLog(`❌ Error switching camera: ${error.message}`, 'error');
    }
  };

  const endCall = () => {
    addDebugLog('📞 Ending call');
    
    // Emit end call signal
    if (socket && sessionId) {
      socket.emit('signal', {
        sessionId,
        signal: { type: 'end-call' }
      });
      
      // Leave the room
      socket.emit('leave_consultation_room', { bookingId, roomId });
    }
    
    cleanup();
    navigation.goBack();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'disconnected': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getConnectionStatusText = () => {
    if (connectionState === 'Initializing') return 'Initializing...';
    
    switch (connectionState) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Waiting for connection';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.statusIndicator, { backgroundColor: getConnectionStatusColor() }]} />
          <Text style={styles.statusText}>{getConnectionStatusText()}</Text>
        </View>
        <View style={styles.statusRight}>
          <Text style={styles.timerText}>{formatTime(callDuration)}</Text>
        </View>
      </View>

      {/* Video Container */}
      <View style={styles.videoContainer}>
        {/* Remote Video (Full Screen) */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          <View style={styles.placeholderVideo}>
            <Icon name="person" size={80} color="#666" />
            <Text style={styles.placeholderText}>Waiting for user to join...</Text>
          </View>
        )}

        {/* Local Video (Picture in Picture) */}
        {localStream && (
          <View style={styles.localVideoContainer}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={isFrontCamera}
            />
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isAudioMuted && styles.controlButtonDisabled]}
          onPress={toggleAudio}
        >
          <Icon
            name={isAudioMuted ? "mic-off" : "mic"}
            size={24}
            color={isAudioMuted ? "#f44336" : "#fff"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isVideoMuted && styles.controlButtonDisabled]}
          onPress={toggleVideo}
        >
          <Icon
            name={isVideoMuted ? "videocam-off" : "videocam"}
            size={24}
            color={isVideoMuted ? "#f44336" : "#fff"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={switchCamera}
        >
          <Icon name="camera-reverse" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={endCall}
        >
          <Icon name="call" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Debug Logs */}
      {showDebugLogs && (
        <ScrollView style={styles.debugLogsContainer}>
          {debugLogs.map((log, index) => (
            <Text key={index} style={[styles.debugLog, log.type === 'error' ? styles.errorLog : log.type === 'success' ? styles.successLog : styles.infoLog]}>
              {log.message}
            </Text>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  statusRight: {
    alignItems: 'flex-end',
  },
  timerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#222',
  },
  placeholderVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: width * 0.3,
    height: height * 0.2,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  localVideo: {
    flex: 1,
    backgroundColor: '#444',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonDisabled: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
  endCallButton: {
    backgroundColor: '#f44336',
  },
  debugLogsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  debugLog: {
    color: '#fff',
    fontSize: 12,
  },
  infoLog: {
    color: '#fff',
  },
  successLog: {
    color: '#4CAF50',
  },
  errorLog: {
    color: '#f44336',
  },
});

export default VideoConsultationScreen;
