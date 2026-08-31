(() => {
  const state = { socket: null, fcmToken: null, audioContext: null, audioUnlocked: false, seenNotifications: new Map(), permissionPrompt: null, callRingTimer: null, callRingStopTimer: null };



  async function unlockNotificationSound() {
    if (state.audioUnlocked) return true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    state.audioContext = state.audioContext || new AudioContextClass();
    try {
      if (state.audioContext.state === "suspended") await state.audioContext.resume();
      state.audioUnlocked = state.audioContext.state === "running";
    } catch (_error) {
      state.audioUnlocked = false;
    }
    if (state.audioUnlocked) document.getElementById("bpDesktopSoundPrompt")?.remove();
    return state.audioUnlocked;
  }

  function showDesktopSoundPrompt() {
    if (!window.location.pathname.startsWith("/serveur/")) return;
    if (state.audioUnlocked || document.getElementById("bpDesktopSoundPrompt")) return;
    const prompt = document.createElement("section");
    prompt.id = "bpDesktopSoundPrompt";
    prompt.className = "fixed bottom-5 right-5 z-[9998] flex max-w-sm items-center gap-3 rounded-2xl border border-orange-200 bg-white p-4 text-neutral-950 shadow-2xl";
    prompt.innerHTML = '<span class="material-symbols-outlined text-2xl text-orange-600">volume_up</span><div class="min-w-0 flex-1"><p class="text-sm font-black">Sonnerie des appels clients</p><p class="mt-1 text-xs font-bold text-neutral-500">Activez le son sur cet appareil.</p></div><button type="button" class="rounded-xl bg-orange-600 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white">Activer</button>';
    prompt.querySelector("button").addEventListener("click", async () => {
      if (await unlockNotificationSound()) {
        playNotificationSound();
        sessionStorage.setItem("bp-desktop-sound-enabled", "1");
      }
    });
    document.body.appendChild(prompt);
  }


  function notificationKey(item) {
    return String(item.id || item.data?.notification_id || `${item.title || 'BarPilote'}:${item.body || ''}`);
  }

  function wasRecentlyShown(item) {
    const key = notificationKey(item);
    const now = Date.now();
    const last = state.seenNotifications.get(key) || 0;
    state.seenNotifications.set(key, now);
    for (const [storedKey, timestamp] of state.seenNotifications.entries()) {
      if (now - timestamp > 12000) state.seenNotifications.delete(storedKey);
    }
    return now - last < 12000;
  }

  function systemNotificationOptions(item) {
    return {
      body: item.body || '',
      icon: '/static/logo_orange.png',
      badge: '/static/logo_orange.png',
      tag: notificationKey(item),
      renotify: true,
      data: { ...(item.data || {}), url: item.url || item.data?.url || '/' },
    };
  }

  function showSystemNotification(item) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = item.title || 'BarPilote';
    const options = systemNotificationOptions(item);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, options))
        .catch(() => new Notification(title, options));
      return;
    }
    new Notification(title, options);
  }

  function showPermissionPrompt() {
    if (!('Notification' in window) || Notification.permission !== 'default' || state.permissionPrompt) return;
    const prompt = document.createElement('section');
    state.permissionPrompt = prompt;
    prompt.className = 'bp-notification-permission-prompt fixed left-4 right-4 bottom-24 z-[9998] mx-auto grid max-w-md grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-orange-100 bg-white p-4 text-neutral-950 shadow-2xl md:right-4 md:left-auto';
    prompt.innerHTML = `
      <div class="min-w-0">
        <p class="text-[10px] font-black uppercase tracking-widest text-orange-600">Alertes commandes</p>
        <p class="mt-1 text-sm font-bold text-neutral-700">Activez les notifications pour recevoir les commandes même quand BarPilote est en arrière-plan.</p>
      </div>
      <button type="button" class="rounded-xl bg-orange-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">Activer</button>
    `;
    const button = prompt.querySelector('button');
    button.addEventListener('click', async () => {
      await unlockNotificationSound();
      const permission = await Notification.requestPermission();
      prompt.remove();
      state.permissionPrompt = null;
      if (permission === 'granted') setupFirebasePush().catch((error) => console.warn('Notifications push indisponibles', error));
    });
    document.body.appendChild(prompt);
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


  function isClientCall(item) {
    return String(item?.data?.kind || "").toUpperCase() === "CLIENT_CALL";
  }

  function stopClientCallRingtone() {
    if (state.callRingTimer) clearInterval(state.callRingTimer);
    if (state.callRingStopTimer) clearTimeout(state.callRingStopTimer);
    state.callRingTimer = null;
    state.callRingStopTimer = null;
    if ("vibrate" in navigator) navigator.vibrate(0);
  }

  function playClientCallRingCycle() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = state.audioContext || new AudioContextClass();
    state.audioContext = ctx;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      if (!state.audioUnlocked) return;
    }
    const now = ctx.currentTime;
    [0, 0.18, 0.48, 0.66].forEach((delay, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + delay;
      osc.type = "sine";
      osc.frequency.setValueAtTime(index % 2 ? 660 : 520, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.32, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  function startClientCallRingtone() {
    stopClientCallRingtone();
    playClientCallRingCycle();
    state.callRingTimer = setInterval(playClientCallRingCycle, 1800);
    state.callRingStopTimer = setTimeout(stopClientCallRingtone, 20000);
    if ("vibrate" in navigator) {
      navigator.vibrate([700, 250, 700, 1200, 700, 250, 700, 1200, 700, 250, 700]);
    }
  }

  function appRoutePrefix() {
    if (window.location.pathname.startsWith('/serveur/')) return '/serveur';
    return '/proprietaire';
  }

  function fcmConfigUrl() {
    return `${appRoutePrefix()}/api/fcm/config/`;
  }

  function fcmTokenUrl() {
    return `${appRoutePrefix()}/api/fcm/token/`;
  }

  function capacitorPlatform() {
    if (!window.Capacitor || typeof window.Capacitor.getPlatform !== 'function') return 'web';
    return window.Capacitor.getPlatform();
  }

  function isNativeCapacitor() {
    const platform = capacitorPlatform();
    return platform === 'android' || platform === 'ios';
  }

  function csrfToken() {
    const match = document.cookie.split('; ').find((row) => row.startsWith('csrftoken='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
  }

  function showRealtimeNotification(item) {
    const title = item.title || 'BarPilote';
    const body = item.body || '';
    if (wasRecentlyShown(item)) return;

    const notificationEvent = new CustomEvent('barpilote:notification', { detail: item, cancelable: true });
    window.dispatchEvent(notificationEvent);
    if (isClientCall(item)) {
      startClientCallRingtone();
    } else {
      playNotificationSound();
    }

    if (notificationEvent.defaultPrevented) return;

    if (document.hidden) {
      showSystemNotification(item);
      return;
    }

    const toast = document.createElement('a');
    toast.href = item.url || item.data?.url || '#';
    toast.className = 'bp-realtime-notification-toast fixed right-4 top-4 z-[9999] max-w-sm rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white shadow-2xl transition';
    toast.innerHTML = '<div class="text-orange-300">' + title + '</div><div class="mt-1 text-white/80">' + body + '</div>' + (isClientCall(item) ? '<div class="mt-2 text-[10px] uppercase tracking-widest text-orange-300">Toucher pour arrêter la sonnerie</div>' : '');
    if (isClientCall(item)) toast.addEventListener("click", stopClientCallRingtone);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), isClientCall(item) ? 20000 : 6000);
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


  async function registerNativePushToken(token) {
    if (!token) return;
    await fetch(fcmTokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ token, platform: capacitorPlatform() }),
    });
  }

  async function setupCapacitorPush() {
    if (!isNativeCapacitor()) return false;
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    const PushNotifications = plugins && plugins.PushNotifications;
    if (!PushNotifications) return false;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return true;

    await PushNotifications.addListener('registration', async (token) => {
      state.fcmToken = token.value;
      await registerNativePushToken(token.value);
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Enregistrement push mobile impossible', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      showRealtimeNotification({
        title: notification.title || notification.data?.title,
        body: notification.body || notification.data?.body,
        data: notification.data || {},
        url: notification.data?.url || '/',
      });
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
      const url = event.notification?.data?.url || '/';
      if (url) window.location.href = url;
    });

    await PushNotifications.register();
    return true;
  }

  async function registerFcmToken(token) {
    await fetch(fcmTokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ token, platform: 'web' }),
    });
  }

  async function setupFirebasePush() {
    if (await setupCapacitorPush()) return;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    const configResponse = await fetch(fcmConfigUrl());
    if (!configResponse.ok) return;
    const config = await configResponse.json();
    if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId || !config.vapidKey) return;

    if (Notification.permission === 'default') {
      showPermissionPrompt();
      return;
    }
    if (Notification.permission !== 'granted') return;

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

  window.BarPiloteNotifications = { connectWebSocket, setupFirebasePush, setupCapacitorPush, playNotificationSound, startClientCallRingtone, showSystemNotification, showPermissionPrompt, stopClientCallRingtone };
  document.addEventListener('DOMContentLoaded', () => {
    ['click', 'touchstart', 'keydown'].forEach((eventName) => {
      document.addEventListener(eventName, unlockNotificationSound, { once: true, passive: true });
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'barpilote-notification-click' && event.data.url) window.location.href = event.data.url;
      });
    }
    setTimeout(showDesktopSoundPrompt, 700);
    connectWebSocket();
    setupFirebasePush().catch((error) => console.warn('Notifications push indisponibles', error));
  });
})();
