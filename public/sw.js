const CACHE_NAME = 'travel-translator-v9';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&family=Orbitron:wght@700;900&display=swap'
];

// 安裝 Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker v2 安裝中...');
    self.skipWaiting(); // 強制立即啟用
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// 啟動 Service Worker
self.addEventListener('activate', event => {
    console.log('Service Worker 啟動中...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('清除舊快取:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 攔截請求
self.addEventListener('fetch', event => {
    // 跳過 API 請求，始終從網路取得
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('/webhook/')) {
        return event.respondWith(fetch(event.request));
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 快取命中，返回快取
                if (response) {
                    return response;
                }
                
                // 從網路取得
                return fetch(event.request).then(response => {
                    // 檢查是否為有效回應
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // 複製回應並快取
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(() => {
                // 離線時返回快取的首頁
                return caches.match('/index.html');
            })
    );
});

// 推播通知 (未來擴充)
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : '新訊息',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('旅遊~即時翻譯', options)
    );
});
