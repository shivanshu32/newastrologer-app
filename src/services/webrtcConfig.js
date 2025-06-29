// WebRTC Configuration Service for Astrologer App
// Provides production-ready WebRTC configurations with TURN servers

export const WebRTCConfig = {
  // Production ICE servers configuration
  getICEServers: () => {
    return [
      // Google STUN servers for NAT traversal
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // TURN servers for restrictive networks
      // Note: Replace with your actual TURN server credentials
      {
        urls: [
          'turn:relay1.expressturn.com:3478',
          'turns:relay1.expressturn.com:5349'
        ],
        username: process.env.TURN_USERNAME || 'efJOINT4K6DPKWSB',
        credential: process.env.TURN_CREDENTIAL || 'Wjk8VVJaVmJUZGhOVEF4'
      },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turns:openrelay.metered.ca:443'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];
  },

  // Enhanced peer connection configuration
  getPeerConnectionConfig: () => {
    return {
      iceServers: WebRTCConfig.getICEServers(),
      iceCandidatePoolSize: 20, // Increased for better connectivity
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all', // Allow both STUN and TURN
      
      // Enhanced configuration for production
      configuration: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        voiceActivityDetection: true
      }
    };
  },

  // Enhanced media constraints for better audio quality
  getMediaConstraints: (isVideoCall = false) => {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000, // High quality audio
        channelCount: 1, // Mono for voice calls
        volume: 1.0,
        
        // Advanced audio processing
        googEchoCancellation: true,
        googAutoGainControl: true,
        googNoiseSuppression: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true,
        googAudioMirroring: false
      }
    };

    if (isVideoCall) {
      constraints.video = {
        facingMode: 'user',
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 30, max: 30 }
      };
    }

    return constraints;
  },

  // Connection quality thresholds
  qualityThresholds: {
    excellent: { rtt: 50, packetLoss: 0.01 },
    good: { rtt: 150, packetLoss: 0.03 },
    fair: { rtt: 300, packetLoss: 0.05 },
    poor: { rtt: 500, packetLoss: 0.1 }
  },

  // Reconnection configuration
  reconnection: {
    maxAttempts: 5,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffFactor: 2
  }
};

export default WebRTCConfig;
