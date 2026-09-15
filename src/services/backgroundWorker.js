// Background Web Worker & Audio Pulse for Nanosecond Precision Timing without Browser Throttling

class BackgroundTimerService {
  constructor() {
    this.worker = null;
    this.callbacks = new Set();
    this.triggerCallbacks = new Set();
    this.initWorker();
  }

  initWorker() {
    // High-Resolution adaptive Web Worker
    const workerScript = `
      let timerId = null;
      let targetTime = 0;
      let leadOffsetMs = 0;
      let isArmed = false;

      function adaptiveLoop() {
        if (!isArmed) return;

        const now = Date.now();
        const remaining = (targetTime - leadOffsetMs) - now;

        if (remaining <= 0) {
          isArmed = false;
          self.postMessage({ type: 'trigger', timestamp: performance.now() });
          return;
        }

        self.postMessage({ type: 'tick', remaining });

        // Adaptive scheduling:
        // > 1500ms: check every 25ms
        // 50ms - 1500ms: check every 2ms
        // < 50ms: tight 0ms / micro-spin for nanosecond-level accuracy
        let delay = 25;
        if (remaining <= 50) {
          delay = 0;
        } else if (remaining <= 1500) {
          delay = 2;
        }

        setTimeout(adaptiveLoop, delay);
      }

      self.onmessage = function(e) {
        const data = e.data;
        if (data.action === 'arm') {
          targetTime = data.targetTime || 0;
          leadOffsetMs = data.leadOffsetMs || 0;
          isArmed = true;
          adaptiveLoop();
        } else if (data.action === 'disarm') {
          isArmed = false;
        } else if (data.action === 'start_heartbeat') {
          if (!timerId) {
            timerId = setInterval(function() {
              self.postMessage({ type: 'heartbeat' });
            }, 50);
          }
        } else if (data.action === 'stop_heartbeat') {
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
      this.worker.onmessage = (e) => {
        const msg = e.data;
        if (msg && msg.type === 'trigger') {
          this.triggerCallbacks.forEach((cb) => cb(msg.timestamp));
        } else {
          this.callbacks.forEach((cb) => cb(msg));
        }
      };
      this.worker.postMessage({ action: 'start_heartbeat' });
    } catch (e) {
      console.warn("Web Worker initialization failed, fallback to window loop:", e);
      setInterval(() => {
        this.callbacks.forEach((cb) => cb({ type: 'heartbeat' }));
      }, 50);
    }
  }

  armTimer(targetTime, leadOffsetMs = 0) {
    if (this.worker) {
      this.worker.postMessage({ action: 'arm', targetTime, leadOffsetMs });
    }
  }

  disarmTimer() {
    if (this.worker) {
      this.worker.postMessage({ action: 'disarm' });
    }
  }

  onTrigger(callback) {
    this.triggerCallbacks.add(callback);
    return () => this.triggerCallbacks.delete(callback);
  }

  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  async requestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
    }
  }

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

  playSound(type = 'launch') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'launch') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {}
  }
}

export const backgroundTimerService = new BackgroundTimerService();
