(() => {
  const state = { socket: null, fcmToken: null, audioContext: null, audioUnlocked: false };



  function unlockNotificationSound() {
    if (state.audioUnlocked) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    state.audioContext = state.audioContext || new AudioContextClass();
    if (state.audioContext.state === 'suspended') state.audioContext.resume().catch(() => {});
    state.audioUnlocked = true;
  }

  function playNotificationSound() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = state.audioContext || new AudioContextClass();
    state.audioContext = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      if (!state.audioUnlocked) return;
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    master.connect(ctx.destination);

    [880, 1175].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + index * 0.13;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.8, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  function csrfToken() {
    const match = document.cookie.split('; ').find((row) => row.startsWith('csrftoken='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
  }

  function showRealtimeNotification(item) {
    const title = item.title || 'BarPilote';
    const body = item.body || '';

    window.dispatchEvent(new CustomEvent('barpilote:notification', { detail: item }));
    playNotificationSound();

    const toast = document.createElement('a');
    toast.href = item.url || item.data?.url || '#';
    toast.className = 'fixed right-4 top-4 z-[9999] max-w-sm rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white shadow-2xl transition';
    toast.innerHTML = `<div class="text-orange-300">${title}</div><div class="mt-1 text-white/80">${body}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);

    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: '/static/logo_orange.png', data: item.data || {} });
    }
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws/notifications/`);
    state.socket = socket;

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data || '{}');
      if (payload.type === 'notification') showRealtimeNotification(payload.notification || {});
    };

    socket.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'ping' }));
      setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, 30000);
    };
  }

  async function registerFcmToken(token) {
    await fetch('/proprietaire/api/fcm/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ token, platform: 'web' }),
    });
  }

  async function setupFirebasePush() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    const configResponse = await fetch('/proprietaire/api/fcm/config/');
    if (!configResponse.ok) return;
    const config = await configResponse.json();
    if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId || !config.vapidKey) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const [{ initializeApp }, { getMessaging, getToken, onMessage }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js'),
    ]);

    const app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
    if (token && token !== state.fcmToken) {
      state.fcmToken = token;
      await registerFcmToken(token);
    }

    onMessage(messaging, (payload) => {
      showRealtimeNotification({
        title: payload.notification?.title || payload.data?.title,
        body: payload.notification?.body || payload.data?.body,
        data: payload.data || {},
        url: payload.data?.url || '/',
      });
    });
  }

  window.BarPiloteNotifications = { connectWebSocket, setupFirebasePush, playNotificationSound };
  document.addEventListener('DOMContentLoaded', () => {
    ['click', 'touchstart', 'keydown'].forEach((eventName) => {
      document.addEventListener(eventName, unlockNotificationSound, { once: true, passive: true });
    });
    connectWebSocket();
    setupFirebasePush().catch((error) => console.warn('Notifications push indisponibles', error));
  });
})();
