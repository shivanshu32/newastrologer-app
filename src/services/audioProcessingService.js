// Advanced Audio Processing Service for Astrologer App
// Implements Web Audio API for enhanced noise suppression, audio level monitoring, and quality optimization

export class AudioProcessingService {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.gainNode = null;
    this.compressor = null;
    this.noiseGate = null;
    this.source = null;
    this.destination = null;
    
    // Audio monitoring
    this.audioLevelCallback = null;
    this.monitoringInterval = null;
    this.isMonitoring = false;
    
    // Noise gate parameters
    this.noiseGateThreshold = -50; // dB
    this.noiseGateRatio = 10;
    this.noiseGateAttack = 0.003; // 3ms
    this.noiseGateRelease = 0.1; // 100ms
    
    // Audio quality metrics
    this.audioMetrics = {
      averageLevel: 0,
      peakLevel: 0,
      noiseLevel: 0,
      snr: 0 // Signal to noise ratio
    };
  }

  // Initialize audio processing pipeline
  async initializeAudioProcessing(inputStream) {
    try {
      console.log('[AudioProcessing] Initializing advanced audio processing...');
      
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create source from input stream
      this.source = this.audioContext.createMediaStreamSource(inputStream);
      
      // Create processing nodes
      await this.createProcessingPipeline();
      
      // Connect the pipeline
      this.connectProcessingPipeline();
      
      // Create output stream
      this.destination = this.audioContext.createMediaStreamDestination();
      this.compressor.connect(this.destination);
      
      console.log('[AudioProcessing] Audio processing pipeline initialized successfully');
      return this.destination.stream;
      
    } catch (error) {
      console.error('[AudioProcessing] Failed to initialize audio processing:', error);
      // Return original stream as fallback
      return inputStream;
    }
  }

  // Create advanced audio processing pipeline
  async createProcessingPipeline() {
    // Create analyser for monitoring
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Create dynamic range compressor
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24; // dB
    this.compressor.knee.value = 30; // dB
    this.compressor.ratio.value = 12; // 12:1 compression
    this.compressor.attack.value = 0.003; // 3ms
    this.compressor.release.value = 0.25; // 250ms
    
    // Create noise gate using gain node with envelope follower
    this.noiseGate = this.audioContext.createGain();
    this.setupNoiseGate();
    
    console.log('[AudioProcessing] Processing nodes created successfully');
  }

  // Connect processing pipeline
  connectProcessingPipeline() {
    // Connect: source -> analyser -> gain -> noise gate -> compressor -> destination
    this.source.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.noiseGate);
    this.noiseGate.connect(this.compressor);
    
    console.log('[AudioProcessing] Processing pipeline connected');
  }

  // Setup noise gate functionality
  setupNoiseGate() {
    // Create a script processor for noise gate logic
    if (this.audioContext.createScriptProcessor) {
      const scriptNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      scriptNode.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        const outputBuffer = event.outputBuffer.getChannelData(0);
        
        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);
        const dbLevel = 20 * Math.log10(rms + 1e-10);
        
        // Apply noise gate
        const gateOpen = dbLevel > this.noiseGateThreshold;
        const targetGain = gateOpen ? 1.0 : 0.1; // Reduce to 10% instead of complete silence
        
        // Smooth gain changes
        const currentGain = this.noiseGate.gain.value;
        const gainDiff = targetGain - currentGain;
        const smoothingFactor = gateOpen ? this.noiseGateAttack : this.noiseGateRelease;
        const newGain = currentGain + (gainDiff * smoothingFactor);
        
        this.noiseGate.gain.setValueAtTime(newGain, this.audioContext.currentTime);
        
        // Copy input to output (processing is done via gain node)
        for (let i = 0; i < inputBuffer.length; i++) {
          outputBuffer[i] = inputBuffer[i];
        }
      };
      
      // Connect script processor in parallel for monitoring
      this.gainNode.connect(scriptNode);
      scriptNode.connect(this.audioContext.destination);
    }
  }

  // Start audio level monitoring
  startAudioLevelMonitoring(callback) {
    if (this.isMonitoring) {
      this.stopAudioLevelMonitoring();
    }
    
    this.audioLevelCallback = callback;
    this.isMonitoring = true;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyArray = new Uint8Array(bufferLength);
    
    const monitor = () => {
      if (!this.isMonitoring) return;
      
      // Get time domain data for level calculation
      this.analyser.getByteTimeDomainData(dataArray);
      
      // Get frequency domain data for noise analysis
      this.analyser.getByteFrequencyData(frequencyArray);
      
      // Calculate audio levels
      const metrics = this.calculateAudioMetrics(dataArray, frequencyArray);
      
      // Update stored metrics
      this.audioMetrics = metrics;
      
      // Call callback with metrics
      if (this.audioLevelCallback) {
        this.audioLevelCallback(metrics);
      }
      
      // Continue monitoring
      requestAnimationFrame(monitor);
    };
    
    monitor();
    console.log('[AudioProcessing] Audio level monitoring started');
  }

  // Calculate comprehensive audio metrics
  calculateAudioMetrics(timeData, frequencyData) {
    // Calculate RMS level (average)
    let sum = 0;
    let peak = 0;
    
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128.0; // Convert to -1 to 1 range
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    
    const rms = Math.sqrt(sum / timeData.length);
    const averageLevel = 20 * Math.log10(rms + 1e-10); // Convert to dB
    const peakLevel = 20 * Math.log10(peak + 1e-10); // Convert to dB
    
    // Calculate noise level (average of lower frequencies)
    let noiseLevelSum = 0;
    const noiseBins = Math.floor(frequencyData.length * 0.1); // Lower 10% of frequencies
    
    for (let i = 0; i < noiseBins; i++) {
      noiseLevelSum += frequencyData[i];
    }
    
    const noiseLevel = (noiseLevelSum / noiseBins) / 255.0 * 100; // Convert to percentage
    
    // Calculate signal level (average of mid frequencies)
    let signalLevelSum = 0;
    const signalStart = Math.floor(frequencyData.length * 0.1);
    const signalEnd = Math.floor(frequencyData.length * 0.8);
    
    for (let i = signalStart; i < signalEnd; i++) {
      signalLevelSum += frequencyData[i];
    }
    
    const signalLevel = (signalLevelSum / (signalEnd - signalStart)) / 255.0 * 100;
    
    // Calculate SNR
    const snr = signalLevel > 0 ? signalLevel / (noiseLevel + 1e-10) : 0;
    
    return {
      averageLevel: Math.max(averageLevel, -60), // Clamp to -60dB minimum
      peakLevel: Math.max(peakLevel, -60),
      noiseLevel: noiseLevel,
      signalLevel: signalLevel,
      snr: snr,
      quality: this.calculateQualityScore(averageLevel, peakLevel, snr)
    };
  }

  // Calculate overall audio quality score
  calculateQualityScore(averageLevel, peakLevel, snr) {
    let score = 0;
    
    // Level score (optimal range: -20dB to -6dB)
    if (averageLevel >= -20 && averageLevel <= -6) {
      score += 40; // 40% for good level
    } else if (averageLevel >= -30 && averageLevel <= -3) {
      score += 20; // 20% for acceptable level
    }
    
    // Dynamic range score
    const dynamicRange = peakLevel - averageLevel;
    if (dynamicRange >= 6 && dynamicRange <= 20) {
      score += 30; // 30% for good dynamic range
    } else if (dynamicRange >= 3 && dynamicRange <= 25) {
      score += 15; // 15% for acceptable dynamic range
    }
    
    // SNR score
    if (snr >= 10) {
      score += 30; // 30% for excellent SNR
    } else if (snr >= 5) {
      score += 20; // 20% for good SNR
    } else if (snr >= 2) {
      score += 10; // 10% for acceptable SNR
    }
    
    return Math.min(score, 100); // Cap at 100%
  }

  // Stop audio level monitoring
  stopAudioLevelMonitoring() {
    this.isMonitoring = false;
    this.audioLevelCallback = null;
    console.log('[AudioProcessing] Audio level monitoring stopped');
  }

  // Adjust gain dynamically
  setGain(gainValue) {
    if (this.gainNode) {
      // Smooth gain changes to avoid clicks
      const currentTime = this.audioContext.currentTime;
      this.gainNode.gain.setTargetAtTime(gainValue, currentTime, 0.1);
      console.log('[AudioProcessing] Gain adjusted to:', gainValue);
    }
  }

  // Adjust noise gate threshold
  setNoiseGateThreshold(threshold) {
    this.noiseGateThreshold = threshold;
    console.log('[AudioProcessing] Noise gate threshold set to:', threshold, 'dB');
  }

  // Get current audio metrics
  getCurrentMetrics() {
    return { ...this.audioMetrics };
  }

  // Apply audio enhancements based on current conditions
  applyAdaptiveEnhancements() {
    const metrics = this.getCurrentMetrics();
    
    // Auto-adjust gain based on level
    if (metrics.averageLevel < -30) {
      this.setGain(Math.min(this.gainNode.gain.value * 1.2, 3.0)); // Boost quiet audio
    } else if (metrics.averageLevel > -6) {
      this.setGain(Math.max(this.gainNode.gain.value * 0.8, 0.3)); // Reduce loud audio
    }
    
    // Adjust noise gate based on noise level
    if (metrics.noiseLevel > 20) {
      this.setNoiseGateThreshold(-40); // More aggressive noise gating
    } else if (metrics.noiseLevel < 5) {
      this.setNoiseGateThreshold(-60); // Less aggressive noise gating
    }
    
    console.log('[AudioProcessing] Applied adaptive enhancements based on metrics:', metrics);
  }

  // Cleanup audio processing
  cleanup() {
    this.stopAudioLevelMonitoring();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.source = null;
    this.destination = null;
    this.analyser = null;
    this.gainNode = null;
    this.compressor = null;
    this.noiseGate = null;
    
    console.log('[AudioProcessing] Audio processing cleanup completed');
  }
}

export default AudioProcessingService;
