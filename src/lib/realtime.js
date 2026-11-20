// بث الإشعارات الفوري — Pusher متوافق مع Soketi.
// لا نُحمّل المكتبة ولا نفتح مقبساً إلا إذا وُجد مفتاح عام في البيئة،
// حتى لا تتأثر اختبارات Node ولا صفحات الزوار بأي اتصال لا داعي له.

import { BASE_URL, getToken } from './api';

let clientPromise = null;
let client = null;
let subscribers = 0;

export function isRealtimeConfigured() {
  return Boolean(import.meta.env?.VITE_PUSHER_APP_KEY);
}

// Laravel's PrivateChannel('owner.9') becomes Pusher's "private-owner.9".
export function channelNameFor(role, id) {
  if (!id) return '';
  const prefix = role === 'space_owner' || role === 'owner' ? 'owner' : 'user';
  return `private-${prefix}.${encodeURIComponent(String(id))}`;
}

function buildOptions() {
  const host = String(import.meta.env?.VITE_PUSHER_HOST || '').trim();
  const port = Number(import.meta.env?.VITE_PUSHER_PORT || (host ? 6001 : 443));
  const scheme = String(import.meta.env?.VITE_PUSHER_SCHEME || (host ? 'http' : 'https'));

  const options = {
    authEndpoint: `${BASE_URL}/broadcasting/auth`,
    // قناة خاصة: نمرّر توكن Sanctum بأنفسنا لأن Pusher لا يرسل ترويسة Bearer.
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        fetch(`${BASE_URL}/broadcasting/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${getToken() || ''}`,
          },
          body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(`broadcast auth ${res.status}`);
            const data = await res.json();
            if (!data?.auth) throw new Error('broadcast auth missing token');
            callback(null, data);
          })
          .catch((err) => callback(err, null));
      },
    }),
    disableStats: true,
    forceTLS: scheme === 'https',
  };

  if (host) {
    options.host = host;
    options.wsHost = host;
    options.wssHost = host;
    options.wsPort = port;
    options.wssPort = port;
  } else {
    options.cluster = String(import.meta.env?.VITE_PUSHER_CLUSTER || 'mt1');
  }
  return options;
}

function getClient() {
  if (!isRealtimeConfigured()) return Promise.resolve(null);
  if (clientPromise) return clientPromise;
  clientPromise = import('pusher-js')
    .then(({ default: Pusher }) => {
      client = new Pusher(String(import.meta.env.VITE_PUSHER_APP_KEY), buildOptions());
      return client;
    })
    .catch((err) => {
      clientPromise = null;
      throw err;
    });
  return clientPromise;
}

/**
 * يشتترك في قناة المستخدم الخاصة ويرجع دالة إلغاء الاشتراك.
 * onReady / onError يسمحان للواجهة بالانتقال إلى الاستطلاع الهادئ إن تعذّر البث.
 */
export async function subscribeToNotifications({ role, userId, onEvent, onReady, onError }) {
  const name = channelNameFor(role, userId);
  if (!name || !isRealtimeConfigured()) return () => {};

  let disposed = false;
  let pusher = null;
  let channel = null;

  const handleError = (err) => { if (!disposed) onError?.(err); };
  const handleDisconnect = () => handleError({ type: 'disconnected' });

  try {
    pusher = await getClient();
    if (disposed || !pusher) return () => {};
    channel = pusher.subscribe(name);
    channel.bind('booking.requested', onEvent);
    channel.bind('booking.status_changed', onEvent);
    channel.bind('pusher:subscription_succeeded', () => {
      if (!disposed) onReady?.();
    });
    channel.bind('pusher:subscription_error', handleError);
    pusher.connection.bind('disconnected', handleDisconnect);
    subscribers += 1;
  } catch (err) {
    handleError(err);
    return () => {};
  }

  return () => {
    disposed = true;
    channel.unbind('booking.requested', onEvent);
    channel.unbind('booking.status_changed', onEvent);
    channel.unbind('pusher:subscription_error', handleError);
    pusher.connection.unbind('disconnected', handleDisconnect);
    pusher.unsubscribe(name);
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0 && client) {
      client.disconnect();
      client = null;
      clientPromise = null;
    }
  };
}
