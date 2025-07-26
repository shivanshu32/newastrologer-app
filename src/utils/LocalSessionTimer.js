import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

/**
 * Frontend-owned session timer utility
 * Provides reliable countdown timer that works across app state transitions
 * Independent of backend socket events for UI updates
 */

const STORAGE_KEY_PREFIX = 'session_timer_';

class LocalSessionTimer {
  constructor() {
    this.timers = new Map(); // sessionId -> timer data
    this.intervals = new Map(); // sessionId -> setInterval reference
    this.callbacks = new Map(); // sessionId -> callback functions
    this.appStateListener = null;
    
    // Listen to app state changes to handle background/foreground
    this.setupAppStateListener();
  }

  setupAppStateListener() {
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      console.log('📱 [LocalSessionTimer] App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        // App came to foreground - sync all active timers
        this.syncAllTimersOnForeground();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - save current state
        this.saveAllTimersToStorage();
      }
    });
  }

  /**
   * Start a new session timer
   * @param {string} sessionId - Unique session identifier
   * @param {number} totalDurationSeconds - Total allowed session time in seconds
   * @param {number} walletBalance - User's wallet balance
   * @param {number} ratePerMinute - Rate per minute for the session
   * @param {object} callbacks - Callback functions { onTick, onWarning, onEnd }
   */
  async startTimer(sessionId, totalDurationSeconds, walletBalance, ratePerMinute, callbacks = {}) {
    try {
      console.log('🔄 [LocalSessionTimer] Starting timer for session:', sessionId);
      console.log('🔄 [LocalSessionTimer] Duration:', totalDurationSeconds, 'seconds');
      console.log('🔄 [LocalSessionTimer] Wallet:', walletBalance, 'Rate:', ratePerMinute);

      // Stop existing timer if any
      this.stopTimer(sessionId);

      const startTime = Date.now();
      const endTime = startTime + (totalDurationSeconds * 1000);

      const timerData = {
        sessionId,
        startTime,
        endTime,
        totalDurationSeconds,
        walletBalance,
        ratePerMinute,
        currency: '₹',
        isActive: true,
        warningsSent: {
          oneMinute: false,
          thirtySeconds: false
        }
      };

      // Store timer data
      this.timers.set(sessionId, timerData);
      this.callbacks.set(sessionId, callbacks);

      // Save to persistent storage
      await this.saveTimerToStorage(sessionId, timerData);

      // Start the interval
      this.startInterval(sessionId);

      console.log('✅ [LocalSessionTimer] Timer started successfully for session:', sessionId);
      return true;

    } catch (error) {
      console.error('❌ [LocalSessionTimer] Error starting timer:', error);
      return false;
    }
  }

  /**
   * Start the setInterval for a session timer
   */
  startInterval(sessionId) {
    const interval = setInterval(() => {
      this.updateTimer(sessionId);
    }, 1000); // Update every second

    this.intervals.set(sessionId, interval);
    console.log('⏰ [LocalSessionTimer] Interval started for session:', sessionId);
  }

  /**
   * Update timer and trigger callbacks
   */
  updateTimer(sessionId) {
    const timerData = this.timers.get(sessionId);
    const callbacks = this.callbacks.get(sessionId);

    if (!timerData || !timerData.isActive) {
      this.stopTimer(sessionId);
      return;
    }

    const currentTime = Date.now();
    const elapsedMs = currentTime - timerData.startTime;
    const remainingMs = timerData.endTime - currentTime;

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
    const remainingMinutes = Math.floor(remainingSeconds / 60);

    // Calculate current billing
    const currentAmount = elapsedMinutes * timerData.ratePerMinute;
    const remainingBalance = timerData.walletBalance - currentAmount;

    const timerUpdate = {
      sessionId,
      elapsedSeconds,
      elapsedMinutes,
      remainingSeconds,
      remainingMinutes,
      currentAmount,
      currency: timerData.currency,
      remainingBalance,
      isCountdown: true,
      totalDurationSeconds: timerData.totalDurationSeconds
    };

    // Trigger onTick callback
    if (callbacks?.onTick) {
      callbacks.onTick(timerUpdate);
    }

    // Check for warnings
    this.checkAndSendWarnings(sessionId, remainingSeconds, callbacks);

    // Check if timer has expired
    if (remainingSeconds <= 0) {
      console.log('🚨 [LocalSessionTimer] Timer expired for session:', sessionId);
      this.handleTimerExpired(sessionId, timerUpdate, callbacks);
      return;
    }

    // Update stored data periodically (every 10 seconds)
    if (elapsedSeconds % 10 === 0) {
      this.saveTimerToStorage(sessionId, timerData);
    }
  }

  /**
   * Check and send warnings at 1 minute and 30 seconds
   */
  checkAndSendWarnings(sessionId, remainingSeconds, callbacks) {
    const timerData = this.timers.get(sessionId);
    
    if (remainingSeconds === 60 && !timerData.warningsSent.oneMinute) {
      console.log('⚠️ [LocalSessionTimer] 1 minute warning for session:', sessionId);
      timerData.warningsSent.oneMinute = true;
      
      if (callbacks?.onWarning) {
        callbacks.onWarning({
          sessionId,
          message: 'Your chat session will end in 1 minute',
          remainingSeconds: 60,
          remainingMinutes: 1
        });
      }
    }

    if (remainingSeconds === 30 && !timerData.warningsSent.thirtySeconds) {
      console.log('⚠️ [LocalSessionTimer] 30 seconds warning for session:', sessionId);
      timerData.warningsSent.thirtySeconds = true;
      
      if (callbacks?.onWarning) {
        callbacks.onWarning({
          sessionId,
          message: 'Your chat session will end in 30 seconds',
          remainingSeconds: 30,
          remainingMinutes: 0
        });
      }
    }
  }

  /**
   * Handle timer expiration
   */
  handleTimerExpired(sessionId, finalTimerUpdate, callbacks) {
    console.log('🏁 [LocalSessionTimer] Handling timer expiration for session:', sessionId);
    
    // Mark as inactive
    const timerData = this.timers.get(sessionId);
    if (timerData) {
      timerData.isActive = false;
    }

    // Trigger onEnd callback
    if (callbacks?.onEnd) {
      callbacks.onEnd({
        sessionId,
        reason: 'time_expired',
        finalTimerUpdate,
        message: 'Chat session ended - time expired'
      });
    }

    // Stop the timer
    this.stopTimer(sessionId);
  }

  /**
   * Stop a session timer
   */
  async stopTimer(sessionId) {
    console.log('🛑 [LocalSessionTimer] Stopping timer for session:', sessionId);

    // Clear interval
    const interval = this.intervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(sessionId);
    }

    // Mark as inactive
    const timerData = this.timers.get(sessionId);
    if (timerData) {
      timerData.isActive = false;
    }

    // Remove from memory
    this.timers.delete(sessionId);
    this.callbacks.delete(sessionId);

    // Remove from storage
    await this.removeTimerFromStorage(sessionId);

    console.log('✅ [LocalSessionTimer] Timer stopped for session:', sessionId);
  }

  /**
   * Get current timer state
   */
  getTimerState(sessionId) {
    const timerData = this.timers.get(sessionId);
    if (!timerData || !timerData.isActive) {
      return null;
    }

    const currentTime = Date.now();
    const elapsedMs = currentTime - timerData.startTime;
    const remainingMs = timerData.endTime - currentTime;

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const elapsedMinutes = Math.ceil(elapsedSeconds / 60);
    const remainingMinutes = Math.floor(remainingSeconds / 60);

    const currentAmount = elapsedMinutes * timerData.ratePerMinute;
    const remainingBalance = timerData.walletBalance - currentAmount;

    return {
      sessionId,
      elapsedSeconds,
      elapsedMinutes,
      remainingSeconds,
      remainingMinutes,
      currentAmount,
      currency: timerData.currency,
      remainingBalance,
      isCountdown: true,
      totalDurationSeconds: timerData.totalDurationSeconds,
      isActive: timerData.isActive
    };
  }

  /**
   * Save timer data to AsyncStorage
   */
  async saveTimerToStorage(sessionId, timerData) {
    try {
      const key = `${STORAGE_KEY_PREFIX}${sessionId}`;
      await AsyncStorage.setItem(key, JSON.stringify(timerData));
    } catch (error) {
      console.error('❌ [LocalSessionTimer] Error saving timer to storage:', error);
    }
  }

  /**
   * Load timer data from AsyncStorage
   */
  async loadTimerFromStorage(sessionId) {
    try {
      const key = `${STORAGE_KEY_PREFIX}${sessionId}`;
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('❌ [LocalSessionTimer] Error loading timer from storage:', error);
      return null;
    }
  }

  /**
   * Remove timer data from AsyncStorage
   */
  async removeTimerFromStorage(sessionId) {
    try {
      const key = `${STORAGE_KEY_PREFIX}${sessionId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('❌ [LocalSessionTimer] Error removing timer from storage:', error);
    }
  }

  /**
   * Save all active timers to storage (called when app goes to background)
   */
  async saveAllTimersToStorage() {
    console.log('💾 [LocalSessionTimer] Saving all timers to storage');
    const promises = [];
    
    for (const [sessionId, timerData] of this.timers) {
      if (timerData.isActive) {
        promises.push(this.saveTimerToStorage(sessionId, timerData));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Sync all timers when app comes to foreground
   */
  async syncAllTimersOnForeground() {
    console.log('🔄 [LocalSessionTimer] Syncing timers on foreground');
    
    // Get all stored timer keys
    const keys = await AsyncStorage.getAllKeys();
    const timerKeys = keys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));

    for (const key of timerKeys) {
      const sessionId = key.replace(STORAGE_KEY_PREFIX, '');
      const storedData = await this.loadTimerFromStorage(sessionId);
      
      if (storedData && storedData.isActive) {
        // Check if timer should still be running
        const currentTime = Date.now();
        const remainingMs = storedData.endTime - currentTime;
        
        if (remainingMs > 0) {
          // Timer should still be active - restore it
          console.log('🔄 [LocalSessionTimer] Restoring timer for session:', sessionId);
          this.timers.set(sessionId, storedData);
          
          // Note: Callbacks need to be re-registered by the calling component
          // The interval will be started when callbacks are registered
        } else {
          // Timer has expired while app was in background
          console.log('⏰ [LocalSessionTimer] Timer expired while in background:', sessionId);
          await this.removeTimerFromStorage(sessionId);
        }
      }
    }
  }

  /**
   * Resume timer with callbacks (called by components on mount/focus)
   */
  resumeTimer(sessionId, callbacks) {
    const timerData = this.timers.get(sessionId);
    if (timerData && timerData.isActive) {
      console.log('▶️ [LocalSessionTimer] Resuming timer for session:', sessionId);
      this.callbacks.set(sessionId, callbacks);
      
      // Start interval if not already running
      if (!this.intervals.has(sessionId)) {
        this.startInterval(sessionId);
      }
      
      return true;
    }
    return false;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessionIds() {
    return Array.from(this.timers.keys()).filter(sessionId => {
      const timerData = this.timers.get(sessionId);
      return timerData && timerData.isActive;
    });
  }

  /**
   * Cleanup - remove app state listener
   */
  cleanup() {
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    
    // Stop all timers
    for (const sessionId of this.timers.keys()) {
      this.stopTimer(sessionId);
    }
  }
}

// Export singleton instance
export default new LocalSessionTimer();
