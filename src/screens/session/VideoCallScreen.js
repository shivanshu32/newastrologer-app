import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

// In a real app, you would import WebRTC libraries
// import { RTCPeerConnection, RTCView, mediaDevices } from 'react-native-webrtc';

const { width, height } = Dimensions.get('window');

const VideoCallScreen = ({ route, navigation }) => {
  const { bookingId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [booking, setBooking] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const { user } = useAuth();
  
  const timerRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  useEffect(() => {
    fetchBookingDetails();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      endCall(false);
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
        type: 'video',
        status: 'active',
        scheduledTime: new Date().toISOString(),
        duration: 15,
        amount: 750,
        perMinuteRate: 50, // 750/15
      };
      
      setBooking(dummyBooking);
      setLoading(false);
      
      // Start session
      startCall();
    } catch (error) {
      console.log('Error fetching booking details:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load video call session. Please try again.');
    }
  };

  const startCall = async () => {
    try {
      // In a real app, this would initialize WebRTC
      // const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      // peerConnectionRef.current = new RTCPeerConnection(configuration);
      
      // const stream = await mediaDevices.getUserMedia({ audio: true, video: true });
      // localStreamRef.current = stream;
      
      // stream.getTracks().forEach(track => {
      //   peerConnectionRef.current.addTrack(track, stream);
      // });
      
      // peerConnectionRef.current.ontrack = (event) => {
      //   remoteStreamRef.current = event.streams[0];
      // };
      
      // Connect to signaling server and handle WebRTC signaling
      
      setSessionActive(true);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.log('Error starting call:', error);
      Alert.alert('Error', 'Failed to start video call. Please try again.');
    }
  };

  const handleMuteToggle = () => {
    // In a real app, this would mute/unmute audio track
    // if (localStreamRef.current) {
    //   const audioTrack = localStreamRef.current.getAudioTracks()[0];
    //   if (audioTrack) {
    //     audioTrack.enabled = isMuted;
    //     setIsMuted(!isMuted);
    //   }
    // }
    
    setIsMuted(!isMuted);
  };

  const handleCameraToggle = () => {
    // In a real app, this would enable/disable video track
    // if (localStreamRef.current) {
    //   const videoTrack = localStreamRef.current.getVideoTracks()[0];
    //   if (videoTrack) {
    //     videoTrack.enabled = isCameraOff;
    //     setIsCameraOff(!isCameraOff);
    //   }
    // }
    
    setIsCameraOff(!isCameraOff);
  };

  const handleCameraFlip = () => {
    // In a real app, this would switch between front and back cameras
    // if (localStreamRef.current) {
    //   const videoTrack = localStreamRef.current.getVideoTracks()[0];
    //   if (videoTrack) {
    //     videoTrack._switchCamera();
    //     setIsFrontCamera(!isFrontCamera);
    //   }
    // }
    
    setIsFrontCamera(!isFrontCamera);
  };

  const handleEndCall = () => {
    Alert.alert(
      'End Call',
      'Are you sure you want to end this consultation session?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Call',
          style: 'destructive',
          onPress: () => endCall(true),
        },
      ]
    );
  };

  const endCall = (navigateToRating = true) => {
    // In a real app, this would clean up WebRTC resources
    // if (peerConnectionRef.current) {
    //   peerConnectionRef.current.close();
    //   peerConnectionRef.current = null;
    // }
    
    // if (localStreamRef.current) {
    //   localStreamRef.current.getTracks().forEach(track => track.stop());
    //   localStreamRef.current = null;
    // }
    
    // remoteStreamRef.current = null;
    
    if (timerRef.current) clearInterval(timerRef.current);
    setSessionActive(false);
    setSessionEnded(true);
    
    if (navigateToRating) {
      // Calculate charges
      const minutes = Math.ceil(sessionTime / 60);
      const charges = minutes * (booking?.perMinuteRate || 0);
      
      // Navigate to rating screen
      navigation.replace('Rating', {
        bookingId,
        sessionDuration: minutes,
        charges,
      });
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <Text style={styles.loadingText}>Connecting to video call...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Remote Video Stream (User) */}
      <View style={styles.remoteStreamContainer}>
        {/* In a real app, this would be an RTCView */}
        {/* <RTCView
          streamURL={remoteStreamRef.current?.toURL()}
          style={styles.remoteStream}
          objectFit="cover"
        /> */}
        
        {/* Placeholder for remote stream */}
        <View style={styles.remoteStreamPlaceholder}>
          <Ionicons name="person" size={80} color="#fff" />
          <Text style={styles.remoteStreamText}>{booking?.userName}</Text>
        </View>
        
        {/* Session Timer */}
        <View style={styles.timerContainer}>
          <Ionicons name="time-outline" size={16} color="#fff" />
          <Text style={styles.timerText}>{formatTime(sessionTime)}</Text>
        </View>
      </View>
      
      {/* Local Video Stream (Astrologer) */}
      <View style={styles.localStreamContainer}>
        {/* In a real app, this would be an RTCView */}
        {/* <RTCView
          streamURL={localStreamRef.current?.toURL()}
          style={styles.localStream}
          objectFit="cover"
        /> */}
        
        {/* Placeholder for local stream */}
        <View style={[
          styles.localStreamPlaceholder,
          isCameraOff && styles.cameraOffPlaceholder,
        ]}>
          {isCameraOff ? (
            <Ionicons name="videocam-off" size={30} color="#fff" />
          ) : (
            <Text style={styles.localStreamText}>You</Text>
          )}
        </View>
      </View>
      
      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={handleMuteToggle}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
          onPress={handleCameraToggle}
        >
          <Ionicons
            name={isCameraOff ? 'videocam-off' : 'videocam'}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={24} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleCameraFlip}
        >
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  remoteStreamContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteStream: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  remoteStreamPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteStreamText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 10,
  },
  localStreamContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: width * 0.3,
    height: height * 0.2,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  localStream: {
    width: '100%',
    height: '100%',
  },
  localStreamPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8A2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOffPlaceholder: {
    backgroundColor: '#555',
  },
  localStreamText: {
    color: '#fff',
    fontSize: 14,
  },
  timerContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  timerText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: 'bold',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#8A2BE2',
  },
  endCallButton: {
    backgroundColor: '#FF3B30',
    transform: [{ rotate: '135deg' }],
  },
});

export default VideoCallScreen;
