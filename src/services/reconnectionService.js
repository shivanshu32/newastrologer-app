// WebRTC Reconnection Service for Astrologer App
// Handles automatic reconnection with exponential backoff and connection quality monitoring

import WebRTCConfig from './webrtcConfig';

export class ReconnectionService {
  constructor(onReconnectAttempt, onReconnectSuccess, onReconnectFailed) {
    this.onReconnectAttempt = onReconnectAttempt;
    this.onReconnectSuccess = onReconnectSuccess;
    this.onReconnectFailed = onReconnectFailed;
    
    this.reconnectAttempts = 0;
    this.maxAttempts = WebRTCConfig.reconnection.maxAttempts;
    this.currentDelay = WebRTCConfig.reconnection.initialDelay;
    this.isReconnecting = false;
    this.reconnectTimer = null;
    
    // Connection quality monitoring
    this.qualityCheckInterval = null;
    this.lastQualityCheck = null;
    this.connectionQuality = 'unknown';
  }

  // Start reconnection process
  startReconnection(peerConnection, socket, sessionData) {
    if (this.isReconnecting) {
      console.log('[Reconnection] Already reconnecting, skipping...');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts = 0;
    this.currentDelay = WebRTCConfig.reconnection.initialDelay;

    console.log('[Reconnection] Starting reconnection process...');
    this.attemptReconnection(peerConnection, socket, sessionData);
  }

  // Attempt reconnection with exponential backoff
  async attemptReconnection(peerConnection, socket, sessionData) {
    if (this.reconnectAttempts >= this.maxAttempts) {
      console.error('[Reconnection] Max reconnection attempts reached');
      this.isReconnecting = false;
      this.onReconnectFailed('Max attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[Reconnection] Attempt ${this.reconnectAttempts}/${this.maxAttempts} in ${this.currentDelay}ms`);
    
    if (this.onReconnectAttempt) {
      this.onReconnectAttempt(this.reconnectAttempts, this.currentDelay);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Close existing connection
        if (peerConnection) {
          peerConnection.close();
        }

        // Create new peer connection
        const newPeerConnection = await this.createNewConnection(socket, sessionData);
        
        if (newPeerConnection) {
          console.log('[Reconnection] Successfully reconnected');
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          
          if (this.onReconnectSuccess) {
            this.onReconnectSuccess(newPeerConnection);
          }
          
          // Start quality monitoring
          this.startQualityMonitoring(newPeerConnection);
        } else {
          throw new Error('Failed to create new connection');
        }
      } catch (error) {
        console.error('[Reconnection] Reconnection attempt failed:', error);
        
        // Exponential backoff
        this.currentDelay = Math.min(
          this.currentDelay * WebRTCConfig.reconnection.backoffFactor,
          WebRTCConfig.reconnection.maxDelay
        );
        
        // Try again
        this.attemptReconnection(peerConnection, socket, sessionData);
      }
    }, this.currentDelay);
  }

  // Create new WebRTC connection
  async createNewConnection(socket, sessionData) {
    try {
      const config = WebRTCConfig.getPeerConnectionConfig();
      const peerConnection = new RTCPeerConnection(config);
      
      // Get media stream with enhanced constraints
      const constraints = WebRTCConfig.getMediaConstraints(false);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Set up event handlers
      this.setupConnectionEventHandlers(peerConnection, socket);
      
      // Initiate connection
      await this.initiateConnection(peerConnection, socket, sessionData);
      
      return peerConnection;
    } catch (error) {
      console.error('[Reconnection] Failed to create new connection:', error);
      return null;
    }
  }

  // Setup event handlers for new connection
  setupConnectionEventHandlers(peerConnection, socket) {
    peerConnection.onconnectionstatechange = () => {
      console.log('[Reconnection] Connection state:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed' || 
          peerConnection.connectionState === 'disconnected') {
        console.log('[Reconnection] Connection failed, attempting reconnection...');
        this.startReconnection(peerConnection, socket);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('[Reconnection] ICE connection state:', peerConnection.iceConnectionState);
      
      if (peerConnection.iceConnectionState === 'failed' ||
          peerConnection.iceConnectionState === 'disconnected') {
        console.log('[Reconnection] ICE connection failed, attempting reconnection...');
        this.startReconnection(peerConnection, socket);
      }
    };
  }

  // Initiate connection process
  async initiateConnection(peerConnection, socket, sessionData) {
    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('webrtc-offer', {
      sessionId: sessionData.sessionId,
      offer: offer
    });
  }

  // Start connection quality monitoring
  startQualityMonitoring(peerConnection) {
    this.stopQualityMonitoring(); // Clear any existing monitoring
    
    this.qualityCheckInterval = setInterval(async () => {
      try {
        const stats = await this.getConnectionStats(peerConnection);
        this.analyzeConnectionQuality(stats);
      } catch (error) {
        console.error('[Quality] Failed to get connection stats:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  // Get connection statistics
  async getConnectionStats(peerConnection) {
    const stats = await peerConnection.getStats();
    const result = {
      audio: {},
      connection: {}
    };

    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
        result.audio.inbound = {
          packetsReceived: report.packetsReceived,
          packetsLost: report.packetsLost,
          jitter: report.jitter,
          bytesReceived: report.bytesReceived
        };
      } else if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
        result.audio.outbound = {
          packetsSent: report.packetsSent,
          bytesSent: report.bytesSent
        };
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        result.connection = {
          currentRoundTripTime: report.currentRoundTripTime,
          availableOutgoingBitrate: report.availableOutgoingBitrate,
          availableIncomingBitrate: report.availableIncomingBitrate
        };
      }
    });

    return result;
  }

  // Analyze connection quality
  analyzeConnectionQuality(stats) {
    const thresholds = WebRTCConfig.qualityThresholds;
    let quality = 'unknown';

    if (stats.connection.currentRoundTripTime && stats.audio.inbound) {
      const rtt = stats.connection.currentRoundTripTime * 1000; // Convert to ms
      const packetLoss = stats.audio.inbound.packetsLost / 
                        (stats.audio.inbound.packetsReceived + stats.audio.inbound.packetsLost);

      if (rtt <= thresholds.excellent.rtt && packetLoss <= thresholds.excellent.packetLoss) {
        quality = 'excellent';
      } else if (rtt <= thresholds.good.rtt && packetLoss <= thresholds.good.packetLoss) {
        quality = 'good';
      } else if (rtt <= thresholds.fair.rtt && packetLoss <= thresholds.fair.packetLoss) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }
    }

    if (quality !== this.connectionQuality) {
      this.connectionQuality = quality;
      console.log('[Quality] Connection quality changed to:', quality);
      
      // Emit quality change event
      if (typeof window !== 'undefined' && window.postMessage) {
        window.postMessage(JSON.stringify({
          type: 'connection-quality',
          quality: quality,
          stats: stats
        }), '*');
      }
    }
  }

  // Stop quality monitoring
  stopQualityMonitoring() {
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }
  }

  // Stop reconnection process
  stopReconnection() {
    this.isReconnecting = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopQualityMonitoring();
  }

  // Get current connection quality
  getConnectionQuality() {
    return this.connectionQuality;
  }

  // Check if currently reconnecting
  isCurrentlyReconnecting() {
    return this.isReconnecting;
  }
}

export default ReconnectionService;
