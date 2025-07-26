/**
 * Global Timer State Manager
 * Prevents timer resets when EnhancedChatScreen remounts due to navigation
 */

class GlobalTimerState {
  constructor() {
    this.timers = new Map(); // sessionId -> timer state
    this.instances = new Map(); // sessionId -> component instances
  }

  // Get or create timer state for a session
  getTimerState(sessionId) {
    if (!this.timers.has(sessionId)) {
      this.timers.set(sessionId, {
        isActive: false,
        elapsed: 0,
        startTime: null,
        intervalId: null,
        callbacks: {
          onTick: null,
          onWarning: null,
          onEnd: null
        }
      });
    }
    return this.timers.get(sessionId);
  }

  // Register a component instance for a session
  registerInstance(sessionId, componentId, callbacks) {
    console.log(`🔄 [GLOBAL-TIMER] Registering instance ${componentId} for session ${sessionId}`);
    
    if (!this.instances.has(sessionId)) {
      this.instances.set(sessionId, new Set());
    }
    
    this.instances.get(sessionId).add(componentId);
    
    // Update callbacks for this session
    const timerState = this.getTimerState(sessionId);
    timerState.callbacks = callbacks;
    
    console.log(`🔄 [GLOBAL-TIMER] Active instances for session ${sessionId}:`, this.instances.get(sessionId).size);
  }

  // Unregister a component instance
  unregisterInstance(sessionId, componentId) {
    console.log(`🔄 [GLOBAL-TIMER] Unregistering instance ${componentId} for session ${sessionId}`);
    
    if (this.instances.has(sessionId)) {
      this.instances.get(sessionId).delete(componentId);
      
      // If no more instances, clean up timer
      if (this.instances.get(sessionId).size === 0) {
        console.log(`🔄 [GLOBAL-TIMER] No more instances for session ${sessionId}, cleaning up timer`);
        this.stopTimer(sessionId);
        this.instances.delete(sessionId);
        this.timers.delete(sessionId);
      }
    }
  }

  // Start timer for a session
  startTimer(sessionId) {
    const timerState = this.getTimerState(sessionId);
    
    if (timerState.isActive) {
      console.log(`⚠️ [GLOBAL-TIMER] Timer already active for session ${sessionId}`);
      return;
    }

    console.log(`▶️ [GLOBAL-TIMER] Starting timer for session ${sessionId}`);
    
    timerState.isActive = true;
    timerState.startTime = Date.now() - (timerState.elapsed * 1000); // Account for existing elapsed time
    
    timerState.intervalId = setInterval(() => {
      const now = Date.now();
      const newElapsed = Math.floor((now - timerState.startTime) / 1000);
      
      if (newElapsed !== timerState.elapsed) {
        timerState.elapsed = newElapsed;
        
        // Notify all registered instances
        if (timerState.callbacks.onTick) {
          timerState.callbacks.onTick(timerState.elapsed);
        }
        
        console.log(`⏱️ [GLOBAL-TIMER] Session ${sessionId} elapsed: ${timerState.elapsed}s`);
        
        // Handle warnings and end conditions
        if (timerState.elapsed >= 180 && timerState.elapsed < 185 && timerState.callbacks.onWarning) {
          timerState.callbacks.onWarning();
        }
        
        if (timerState.elapsed >= 300 && timerState.callbacks.onEnd) {
          timerState.callbacks.onEnd();
          this.stopTimer(sessionId);
        }
      }
    }, 1000);
  }

  // Stop timer for a session
  stopTimer(sessionId) {
    const timerState = this.getTimerState(sessionId);
    
    if (timerState.intervalId) {
      console.log(`⏹️ [GLOBAL-TIMER] Stopping timer for session ${sessionId}`);
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
    }
    
    timerState.isActive = false;
  }

  // Resume timer for a session (if it was active)
  resumeTimer(sessionId, callbacks) {
    const timerState = this.getTimerState(sessionId);
    
    // Update callbacks
    timerState.callbacks = callbacks;
    
    if (timerState.isActive && !timerState.intervalId) {
      console.log(`▶️ [GLOBAL-TIMER] Resuming timer for session ${sessionId}`);
      this.startTimer(sessionId);
      return true;
    }
    
    return false;
  }

  // Get current timer data for a session
  getTimerData(sessionId) {
    const timerState = this.getTimerState(sessionId);
    return {
      isActive: timerState.isActive,
      elapsed: timerState.elapsed
    };
  }

  // Update timer data from backend sync
  updateTimerData(sessionId, backendData) {
    const timerState = this.getTimerState(sessionId);
    
    console.log(`🔄 [GLOBAL-TIMER] Updating timer data for session ${sessionId}:`, backendData);
    
    if (backendData.elapsed !== undefined && backendData.elapsed > timerState.elapsed) {
      timerState.elapsed = backendData.elapsed;
      timerState.startTime = Date.now() - (timerState.elapsed * 1000);
    }
    
    if (backendData.isActive !== undefined) {
      if (backendData.isActive && !timerState.isActive) {
        this.startTimer(sessionId);
      } else if (!backendData.isActive && timerState.isActive) {
        this.stopTimer(sessionId);
      }
    }
  }

  // Debug method to get all active timers
  getActiveTimers() {
    const active = [];
    for (const [sessionId, timerState] of this.timers.entries()) {
      if (timerState.isActive) {
        active.push({
          sessionId,
          elapsed: timerState.elapsed,
          instances: this.instances.get(sessionId)?.size || 0
        });
      }
    }
    return active;
  }
}

// Export singleton instance
const globalTimerState = new GlobalTimerState();
export default globalTimerState;
