// Mock WebRTCService for Expo Go compatibility
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  registerGlobals
} from './react-native-webrtc';

class MockWebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isInitialized = false;
    
    // Register globals for WebRTC
    registerGlobals();
    
    console.log('[Mock] WebRTCService initialized');
  }

  async initialize() {
    try {
      console.log('[Mock] WebRTCService.initialize called');
      
      // Create peer connection with mock configuration
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Set up event handlers
      this.peerConnection.onicecandidate = (event) => {
        console.log('[Mock] ICE candidate generated:', event.candidate);
        if (this.onIceCandidate && event.candidate) {
          this.onIceCandidate(event.candidate);
        }
      };

      this.peerConnection.onaddstream = (event) => {
        console.log('[Mock] Remote stream added:', event.stream);
        this.remoteStream = event.stream;
        if (this.onRemoteStream) {
          this.onRemoteStream(event.stream);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('[Mock] Connection state changed:', this.peerConnection.connectionState);
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(this.peerConnection.connectionState);
        }
      };

      this.isInitialized = true;
      console.log('[Mock] WebRTC initialized successfully');
      return true;
    } catch (error) {
      console.error('[Mock] WebRTC initialization failed:', error);
      return false;
    }
  }

  async getLocalStream(constraints = { video: true, audio: true }) {
    try {
      console.log('[Mock] Getting local stream with constraints:', constraints);
      
      this.localStream = await mediaDevices.getUserMedia(constraints);
      
      if (this.peerConnection && this.localStream) {
        this.peerConnection.addStream(this.localStream);
      }
      
      console.log('[Mock] Local stream obtained:', this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('[Mock] Failed to get local stream:', error);
      throw error;
    }
  }

  async createOffer() {
    try {
      console.log('[Mock] Creating offer...');
      
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('[Mock] Offer created:', offer);
      return offer;
    } catch (error) {
      console.error('[Mock] Failed to create offer:', error);
      throw error;
    }
  }

  async createAnswer() {
    try {
      console.log('[Mock] Creating answer...');
      
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('[Mock] Answer created:', answer);
      return answer;
    } catch (error) {
      console.error('[Mock] Failed to create answer:', error);
      throw error;
    }
  }

  async handleOffer(offer) {
    try {
      console.log('[Mock] Handling offer:', offer);
      
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const sessionDescription = new RTCSessionDescription(offer);
      await this.peerConnection.setRemoteDescription(sessionDescription);
      
      console.log('[Mock] Offer handled successfully');
    } catch (error) {
      console.error('[Mock] Failed to handle offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    try {
      console.log('[Mock] Handling answer:', answer);
      
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const sessionDescription = new RTCSessionDescription(answer);
      await this.peerConnection.setRemoteDescription(sessionDescription);
      
      console.log('[Mock] Answer handled successfully');
    } catch (error) {
      console.error('[Mock] Failed to handle answer:', error);
      throw error;
    }
  }

  async handleIceCandidate(candidate) {
    try {
      console.log('[Mock] Handling ICE candidate:', candidate);
      
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const iceCandidate = new RTCIceCandidate(candidate);
      await this.peerConnection.addIceCandidate(iceCandidate);
      
      console.log('[Mock] ICE candidate handled successfully');
    } catch (error) {
      console.error('[Mock] Failed to handle ICE candidate:', error);
      throw error;
    }
  }

  toggleAudio() {
    console.log('[Mock] Toggling audio');
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        return audioTracks[0].enabled;
      }
    }
    return false;
  }

  toggleVideo() {
    console.log('[Mock] Toggling video');
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        return videoTracks[0].enabled;
      }
    }
    return false;
  }

  switchCamera() {
    console.log('[Mock] Switching camera');
    // Mock camera switch - in real implementation this would switch between front/back camera
    return Promise.resolve();
  }

  cleanup() {
    console.log('[Mock] Cleaning up WebRTC service');
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.remoteStream = null;
    this.isInitialized = false;
  }

  // Event handler setters
  setOnIceCandidate(callback) {
    this.onIceCandidate = callback;
  }

  setOnRemoteStream(callback) {
    this.onRemoteStream = callback;
  }

  setOnConnectionStateChange(callback) {
    this.onConnectionStateChange = callback;
  }

  // Getters
  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  getPeerConnection() {
    return this.peerConnection;
  }

  getConnectionState() {
    return this.peerConnection ? this.peerConnection.connectionState : 'closed';
  }
}

// Export singleton instance
const webRTCService = new MockWebRTCService();
export default webRTCService;
