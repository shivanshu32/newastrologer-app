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

const VideoConsultationScreen = () => {
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
  
  // Get booking details from route params
  const { bookingId, sessionId, roomId, bookingDetails } = route.params || {};

  // Load HTML content from file
  useEffect(() => {
    const loadHtmlFile = async () => {
      try {
        console.log('[ASTROLOGER-APP] Starting to load webrtc.html');
        
        // Download the asset first
        const asset = Asset.fromModule(require('../assets/webrtc.html'));
        await asset.downloadAsync();
        
        // Read the HTML content
        const htmlContent = await FileSystem.readAsStringAsync(asset.localUri);
        
        console.log('[ASTROLOGER-APP] HTML content loaded successfully, length:', htmlContent.length);
        
        setHtmlContent(htmlContent);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load HTML file:', error);
        setError('Failed to load video consultation interface');
        setLoading(false);
      }
    };

    loadHtmlFile();
  }, []);

  // Handle back button press
  useEffect(() => {
    const backAction = () => {
      Alert.alert(
        'End Call',
        'Are you sure you want to end this call?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => {} },
          { 
            text: 'End Call', 
            style: 'destructive', 
            onPress: () => {
              // Leave the room
              if (socket && roomId) {
                socket.emit('leave_consultation_room', { bookingId, roomId });
              }
              navigation.goBack();
            } 
          }
        ]
      );
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation, socket, bookingId, roomId]);

  // Join consultation room when component mounts
  useEffect(() => {
    if (!socket || !bookingId || !roomId) return;
    
    // Join the room
    socket.emit('join_consultation_room', { bookingId, roomId });
    
    // Start session timer if astrologer
    if (user.role === 'astrologer') {
      socket.emit('start_session_timer', { bookingId });
    }
    
    // Listen for session timer updates
    socket.on('session_timer', (data) => {
      setSessionInfo({
        duration: data.durationSeconds,
        currentAmount: data.currentAmount
      });
    });
    
    // Listen for session status updates
    socket.on('session_status', (data) => {
      if (data.status === 'disconnected') {
        Alert.alert(
          'Call Ended',
          'The consultation has ended.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    });
    
    // Socket event listeners
    const handleSignal = (data) => {
      if (webViewRef.current && data.sessionId === sessionId) {
        webViewRef.current.postMessage(JSON.stringify(data));
      }
    };

    socket.on('signal', handleSignal);

    // Clean up listeners when component unmounts
    return () => {
      socket.off('session_timer');
      socket.off('session_status');
      socket.off('signal', handleSignal);
      
      // Leave the room when component unmounts
      socket.emit('leave_consultation_room', { bookingId, roomId });
    };
  }, [socket, bookingId, roomId, navigation, user.role, sessionId]);

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'log':
          console.log(`[WebRTC-LOG] ${message.log}`);
          return; // Don't process further
          
        case 'ready':
          console.log('[ASTROLOGER-APP] WebView is ready, sending initialization data');
          // WebView is ready, send initial data
          sendMessageToWebView({
            type: 'init',
            userId: user.id,
            bookingId,
            sessionId,
            roomId
          });
          
          // If astrologer, create offer
          if (user.role === 'astrologer') {
            console.log('[ASTROLOGER-APP] Requesting WebView to create WebRTC offer');
            sendMessageToWebView({
              type: 'create-offer'
            });
          }
          break;
          
        case 'offer':
          console.log('[ASTROLOGER-APP] Received WebRTC offer from WebView, forwarding to server');
          // Forward offer to server
          if (socket) {
            socket.emit('signal', {
              roomId,
              sessionId,
              bookingId,
              signal: message,
              to: 'user'
            });
          }
          break;
          
        case 'answer':
          console.log('[ASTROLOGER-APP] Received WebRTC answer from WebView, forwarding to server');
          // Forward answer to server
          if (socket) {
            socket.emit('signal', {
              roomId,
              sessionId,
              bookingId,
              signal: message,
              to: 'user'
            });
          }
          break;
          
        case 'ice-candidate':
          console.log('[ASTROLOGER-APP] Received ICE candidate from WebView, forwarding to server');
          // Forward ICE candidate to server
          if (socket) {
            socket.emit('signal', {
              roomId,
              sessionId,
              bookingId,
              signal: message,
              to: 'user'
            });
          }
          break;
          
        case 'end-call-request':
          console.log('[ASTROLOGER-APP] User requested to end call from WebView');
          // User requested to end call from WebView
          Alert.alert(
            'End Call',
            'Are you sure you want to end this call?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => {} },
              { 
                text: 'End Call', 
                style: 'destructive', 
                onPress: () => {
                  console.log('[ASTROLOGER-APP] User confirmed end call, leaving room');
                  // Leave the room
                  if (socket && roomId) {
                    socket.emit('leave_consultation_room', { bookingId, roomId });
                  }
                  navigation.goBack();
                } 
              }
            ]
          );
          break;
          
        case 'error':
          console.error('[ASTROLOGER-APP] WebRTC error:', message.error);
          setError(`Video call error: ${message.error}`);
          break;
          
        case 'call-ended':
          console.log('[ASTROLOGER-APP] Call ended from WebView');
          // Call ended from WebView
          if (socket && roomId) {
            socket.emit('leave_consultation_room', { bookingId, roomId });
          }
          navigation.goBack();
          break;
          
        default:
          console.log(`[ASTROLOGER-APP] Unhandled message type from WebView: ${message.type}`);
      }
    } catch (err) {
      console.error('[ASTROLOGER-APP] Error handling WebView message:', err, event.nativeEvent.data);
    }
  };

  // Send message to WebView
  const sendMessageToWebView = (message) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(message));
    }
  };

  // Show loading indicator while HTML content is being loaded
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Setting up video call...</Text>
      </View>
    );
  }

  // Show error message if there was an error loading the HTML content
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
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
        onError={(err) => {
          console.error('[ASTROLOGER-APP] WebView error:', err);
          setError(`WebView error: ${err}`);
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
    marginTop: 10,
    color: '#fff',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default VideoConsultationScreen;
