// Background Web Worker & Audio Pulse to prevent browser throttling when tab is minimized or inactive

class BackgroundTimerService {
  constructor() {
    this.worker = null;
    this.callbacks = new Set();
    this.audioCtx = null;
    this.initWorker();
  }

  initWorker() {
    // Inline Web Worker blob that runs an unthrottled timer loop in the background
    const workerScript = `
      let timerId = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timerId) clearInterval(timerId);
          timerId = setInterval(function() {
            self.postMessage('tick');
          }, 20); // 20ms unthrottled background heartbeat
        } else if (e.data === 'stop') {
          if (timerId) {
            clearInterval(timerId);
            timerId = null;
          }
        }
      };
    `;

    try {
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = () => {
        this.callbacks.forEach((cb) => cb());
      };
      this.worker.postMessage('start');
    } catch (e) {
      console.warn("Web Worker initialization failed, fallback to window loop:", e);
      setInterval(() => {
        this.callbacks.forEach((cb) => cb());
      }, 50);
    }
  }

  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Request browser desktop notification permission
   */
  async requestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
    }
  }

  /**
   * Send Desktop Notification (works when user is on another app or minimized)
   */
  sendNotification(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.svg',
          requireInteraction: true,
        });
      }
    } catch (e) {
      console.warn("Desktop notification failed:", e);
    }
  }

  /**
   * Audio chime alert
   */
  playSound(type = 'launch') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'launch') {
        // Fast ascending cyber chime
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'success') {
        // Victory double-beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // AudioContext might be blocked until user gesture
    }
  }
}

export const backgroundTimerService = new BackgroundTimerService();
