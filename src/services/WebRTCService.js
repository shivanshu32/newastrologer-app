import { getWebRTCImports } from '../config/expoConfig';

// Conditional imports for Expo Go compatibility
const {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals
} = getWebRTCImports();

class WebRTCService {
  constructor() {
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
    
    // Register WebRTC globals
    registerGlobals();
  }

  async initializeLocalStream(isVideoCall = true) {
    try {
      console.log('[WebRTC] Requesting media access...');
      
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      if (isVideoCall) {
        constraints.video = {
          mandatory: {
            minWidth: 640,
            minHeight: 480,
            minFrameRate: 30
          },
          facingMode: 'user'
        };
      }

      const stream = await mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      
      console.log('[WebRTC] Local stream initialized:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      return stream;
    } catch (error) {
      console.error('[WebRTC] Error accessing media devices:', error);
      throw error;
    }
  }

  async getLocalStream(isVideoCall = true) {
    if (!this.localStream) {
      return await this.initializeLocalStream(isVideoCall);
    }
    return this.localStream;
  }

  async createPeerConnection(onRemoteStream, onIceCandidate, onConnectionStateChange) {
    try {
      console.log('[WebRTC] Creating peer connection...');
      
      // Initialize local stream first if not already done
      if (!this.localStream) {
        console.log('[WebRTC] Local stream not initialized, initializing now...');
        await this.initializeLocalStream(true);
      }
      
      this.peerConnection = new RTCPeerConnection(this.configuration);

      // Add local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          console.log('[WebRTC] Adding track:', track.kind);
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      // Handle remote stream
      this.peerConnection.onaddstream = (event) => {
        console.log('[WebRTC] Received remote stream');
        this.remoteStream = event.stream;
        onRemoteStream(event.stream);
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WebRTC] ICE candidate generated');
          onIceCandidate(event.candidate);
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection.connectionState;
        console.log('[WebRTC] Connection state changed:', state);
        if (onConnectionStateChange) {
          onConnectionStateChange(state);
        }
      };

      // Handle ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection.iceConnectionState;
        console.log('[WebRTC] ICE connection state changed:', state);
      };

      return this.peerConnection;
    } catch (error) {
      console.error('[WebRTC] Error creating peer connection:', error);
      throw error;
    }
  }

  async createOffer() {
    try {
      console.log('[WebRTC] Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] Offer created and set as local description');
      
      return {
        type: offer.type,
        sdp: offer.sdp
      };
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      throw error;
    }
  }

  async createAnswer(offer) {
    try {
      console.log('[WebRTC] Setting remote description (offer)...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] Remote description set, creating answer...');
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('[WebRTC] Answer created and set as local description');
      
      return {
        type: answer.type,
        sdp: answer.sdp
      };
    } catch (error) {
      console.error('[WebRTC] Error creating answer:', error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    try {
      console.log('[WebRTC] Handling answer, setting remote description...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC] Answer set as remote description successfully');
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
      throw error;
    }
  }

  async handleOffer(offer) {
    try {
      console.log('[WebRTC] Handling offer, setting remote description...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] Offer set as remote description successfully');
    } catch (error) {
      console.error('[WebRTC] Error handling offer:', error);
      throw error;
    }
  }

  async handleIceCandidate(candidate) {
    try {
      console.log('[WebRTC] Adding ICE candidate');
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ICE candidate added successfully');
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
      throw error;
    }
  }

  async setRemoteDescription(description) {
    try {
      console.log('[WebRTC] Setting remote description:', description.type);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
      console.log('[WebRTC] Remote description set successfully');
    } catch (error) {
      console.error('[WebRTC] Error setting remote description:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate) {
    try {
      console.log('[WebRTC] Adding ICE candidate');
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ICE candidate added successfully');
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
      throw error;
    }
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('[WebRTC] Audio toggled:', audioTrack.enabled ? 'ON' : 'OFF');
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('[WebRTC] Video toggled:', videoTrack.enabled ? 'ON' : 'OFF');
        return videoTrack.enabled;
      }
    }
    return false;
  }

  switchCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack && videoTrack._switchCamera) {
        console.log('[WebRTC] Switching camera...');
        videoTrack._switchCamera();
      }
    }
  }

  getConnectionStats() {
    if (this.peerConnection) {
      return {
        connectionState: this.peerConnection.connectionState,
        iceConnectionState: this.peerConnection.iceConnectionState,
        signalingState: this.peerConnection.signalingState
      };
    }
    return null;
  }

  endCall() {
    console.log('[WebRTC] Ending call and cleaning up...');
    
    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('[WebRTC] Stopped track:', track.kind);
      });
      this.localStream = null;
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('[WebRTC] Peer connection closed');
    }
    
    // Clear remote stream
    this.remoteStream = null;
    
    console.log('[WebRTC] Cleanup completed');
  }

  cleanup() {
    return this.endCall();
  }
}

// Export singleton instance
export default new WebRTCService();
