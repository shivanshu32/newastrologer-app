// Mock implementation for react-native-webrtc to enable Expo Go compatibility
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Mock RTCView component
export const RTCView = ({ style, streamURL, ...props }) => (
  <View style={[styles.mockRTCView, style]} {...props}>
    <Text style={styles.mockText}>
      {streamURL ? 'Video Stream' : 'No Stream'}
    </Text>
  </View>
);

// Mock WebRTC classes and functions
export class RTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDescription = null;
    this.remoteDescription = null;
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.signalingState = 'stable';
    this.onicecandidate = null;
    this.onconnectionstatechange = null;
    this.oniceconnectionstatechange = null;
    this.onsignalingstatechange = null;
    this.onaddstream = null;
    this.ontrack = null;
  }

  async createOffer(options = {}) {
    console.log('[Mock] RTCPeerConnection.createOffer called');
    return {
      type: 'offer',
      sdp: 'mock-offer-sdp-' + Date.now()
    };
  }

  async createAnswer(options = {}) {
    console.log('[Mock] RTCPeerConnection.createAnswer called');
    return {
      type: 'answer',
      sdp: 'mock-answer-sdp-' + Date.now()
    };
  }

  async setLocalDescription(description) {
    console.log('[Mock] RTCPeerConnection.setLocalDescription called', description);
    this.localDescription = description;
    this.signalingState = 'have-local-offer';
    if (this.onsignalingstatechange) {
      this.onsignalingstatechange();
    }
  }

  async setRemoteDescription(description) {
    console.log('[Mock] RTCPeerConnection.setRemoteDescription called', description);
    this.remoteDescription = description;
    this.signalingState = 'have-remote-offer';
    if (this.onsignalingstatechange) {
      this.onsignalingstatechange();
    }
  }

  async addIceCandidate(candidate) {
    console.log('[Mock] RTCPeerConnection.addIceCandidate called', candidate);
  }

  addStream(stream) {
    console.log('[Mock] RTCPeerConnection.addStream called', stream);
  }

  addTrack(track, stream) {
    console.log('[Mock] RTCPeerConnection.addTrack called', track, stream);
  }

  removeStream(stream) {
    console.log('[Mock] RTCPeerConnection.removeStream called', stream);
  }

  close() {
    console.log('[Mock] RTCPeerConnection.close called');
    this.connectionState = 'closed';
    if (this.onconnectionstatechange) {
      this.onconnectionstatechange();
    }
  }

  getStats() {
    console.log('[Mock] RTCPeerConnection.getStats called');
    return Promise.resolve({});
  }
}

export class RTCIceCandidate {
  constructor(init) {
    this.candidate = init?.candidate || 'mock-candidate';
    this.sdpMLineIndex = init?.sdpMLineIndex || 0;
    this.sdpMid = init?.sdpMid || '0';
  }
}

export class RTCSessionDescription {
  constructor(init) {
    this.type = init?.type || 'offer';
    this.sdp = init?.sdp || 'mock-sdp';
  }
}

export class MediaStream {
  constructor(tracks = []) {
    this.id = 'mock-stream-' + Date.now();
    this.active = true;
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }

  getAudioTracks() {
    return this.tracks.filter(track => track.kind === 'audio');
  }

  getVideoTracks() {
    return this.tracks.filter(track => track.kind === 'video');
  }

  addTrack(track) {
    this.tracks.push(track);
  }

  removeTrack(track) {
    this.tracks = this.tracks.filter(t => t !== track);
  }

  clone() {
    return new MediaStream([...this.tracks]);
  }
}

export class MediaStreamTrack {
  constructor(kind = 'video') {
    this.id = 'mock-track-' + Date.now();
    this.kind = kind;
    this.label = `Mock ${kind} track`;
    this.enabled = true;
    this.muted = false;
    this.readyState = 'live';
  }

  stop() {
    this.readyState = 'ended';
  }

  clone() {
    return new MediaStreamTrack(this.kind);
  }
}

// Mock mediaDevices
export const mediaDevices = {
  async getUserMedia(constraints = {}) {
    console.log('[Mock] mediaDevices.getUserMedia called with constraints:', constraints);
    
    const tracks = [];
    
    if (constraints.video) {
      tracks.push(new MediaStreamTrack('video'));
    }
    
    if (constraints.audio) {
      tracks.push(new MediaStreamTrack('audio'));
    }
    
    return new MediaStream(tracks);
  },

  async enumerateDevices() {
    console.log('[Mock] mediaDevices.enumerateDevices called');
    return [
      {
        deviceId: 'mock-camera-1',
        kind: 'videoinput',
        label: 'Mock Camera 1',
        groupId: 'mock-group-1'
      },
      {
        deviceId: 'mock-microphone-1',
        kind: 'audioinput',
        label: 'Mock Microphone 1',
        groupId: 'mock-group-2'
      }
    ];
  },

  async getDisplayMedia(constraints = {}) {
    console.log('[Mock] mediaDevices.getDisplayMedia called');
    return new MediaStream([new MediaStreamTrack('video')]);
  }
};

// Mock registerGlobals function
export const registerGlobals = () => {
  console.log('[Mock] registerGlobals called');
};

const styles = StyleSheet.create({
  mockRTCView: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  mockText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});
