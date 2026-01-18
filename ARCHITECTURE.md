# 🌏 旅遊~即時翻譯 - 完整架構設計

## 📐 系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                        使用者端                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐        ┌─────────────┐        ┌───────────┐  │
│   │   PWA App   │        │  LINE App   │        │  Web 版   │  │
│   │  (手機安裝)  │        │  (聊天機器人) │        │ (瀏覽器)  │  │
│   └──────┬──────┘        └──────┬──────┘        └─────┬─────┘  │
│          │                      │                      │        │
└──────────┼──────────────────────┼──────────────────────┼────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Railway 雲端服務                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                   Node.js / Express                      │  │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │  │
│   │  │ 靜態檔案   │  │ LINE Bot  │  │   翻譯 API 路由    │   │  │
│   │  │ (PWA/Web) │  │  Webhook  │  │  /api/translate   │   │  │
│   │  └───────────┘  └───────────┘  └───────────────────┘   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│   ┌──────────────────────────┼──────────────────────────────┐  │
│   │                    服務整合層                             │  │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │  │
│   │  │  Google   │  │  DeepL    │  │   OpenAI Whisper  │   │  │
│   │  │ Translate │  │    API    │  │   (語音辨識)       │   │  │
│   │  └───────────┘  └───────────┘  └───────────────────┘   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    資料儲存 (可選)                        │  │
│   │  ┌───────────┐  ┌───────────┐                          │  │
│   │  │  Redis    │  │  SQLite   │                          │  │
│   │  │  (快取)   │  │ (歷史記錄) │                          │  │
│   │  └───────────┘  └───────────┘                          │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 專案目錄結構

```
travel-translator/
├── 📂 public/                    # 前端靜態檔案
│   ├── index.html               # PWA 主頁面 (含開機動畫)
│   ├── manifest.json            # PWA 設定
│   ├── sw.js                    # Service Worker
│   ├── 📂 icons/                # App 圖示
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── 📂 css/
│   │   └── style.css
│   └── 📂 js/
│       ├── app.js               # 主程式邏輯
│       ├── speech.js            # 語音辨識/合成
│       └── translate.js         # 翻譯 API 呼叫
│
├── 📂 src/                       # 後端程式碼
│   ├── index.js                 # Express 主入口
│   ├── 📂 routes/
│   │   ├── translate.js         # 翻譯 API
│   │   └── linebot.js           # LINE Bot Webhook
│   ├── 📂 services/
│   │   ├── translator.js        # 翻譯服務整合
│   │   ├── speechToText.js      # 語音轉文字
│   │   └── textToSpeech.js      # 文字轉語音
│   └── 📂 utils/
│       └── languages.js         # 語言代碼對照表
│
├── .env                         # 環境變數 (勿上傳)
├── .env.example                 # 環境變數範例
├── package.json
├── railway.json                 # Railway 部署設定
└── README.md
```

---

## 🚂 Railway 部署設定

### railway.json
```json
{
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
        "builder": "NIXPACKS"
    },
    "deploy": {
        "numReplicas": 1,
        "startCommand": "node src/index.js",
        "healthcheckPath": "/health",
        "healthcheckTimeout": 30,
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 3
    }
}
```

### 環境變數 (.env)
```env
# 伺服器設定
PORT=3000
NODE_ENV=production

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=你的LINE_Channel_Access_Token
LINE_CHANNEL_SECRET=你的LINE_Channel_Secret

# 翻譯 API (擇一或多個)
GOOGLE_TRANSLATE_API_KEY=你的Google_API_Key
DEEPL_API_KEY=你的DeepL_API_Key

# OpenAI (語音辨識)
OPENAI_API_KEY=你的OpenAI_API_Key

# 可選：資料庫
DATABASE_URL=你的資料庫連線字串
REDIS_URL=你的Redis連線字串
```

---

## 🤖 LINE Bot 整合設計

### LINE Bot 功能流程

```
使用者傳送訊息
      │
      ▼
┌─────────────────┐
│  LINE Platform  │
└────────┬────────┘
         │ Webhook POST
         ▼
┌─────────────────────────────────────────────┐
│           Railway Server                     │
│  ┌───────────────────────────────────────┐  │
│  │         /webhook/line                  │  │
│  │                                        │  │
│  │  1. 驗證 LINE Signature               │  │
│  │  2. 解析訊息類型                       │  │
│  │     ├── 文字訊息 → 直接翻譯            │  │
│  │     └── 語音訊息 → STT → 翻譯          │  │
│  │  3. 呼叫翻譯 API                       │  │
│  │  4. 回傳翻譯結果 + 語音                │  │
│  │                                        │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### LINE Bot 指令設計

| 指令 | 功能 | 範例 |
|-----|------|------|
| `直接輸入文字` | 自動翻譯 (預設中→英) | `你好` → `Hello` |
| `/設定 語言A 語言B` | 設定翻譯方向 | `/設定 中文 日文` |
| `/語言` | 顯示支援語言列表 | 顯示 20 種語言 |
| `/交換` | 交換翻譯方向 | 中→日 變成 日→中 |
| `/說明` | 使用說明 | 顯示操作指南 |
| `🎤 語音訊息` | 語音翻譯 | 自動辨識並翻譯 |

---

## 💻 核心程式碼

### 後端主程式 (src/index.js)

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const lineRouter = require('./routes/linebot');
const translateRouter = require('./routes/translate');

const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// 健康檢查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/translate', translateRouter);
app.use('/webhook/line', lineRouter);

// PWA 路由 (所有其他請求導向 index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`🌏 旅遊翻譯伺服器啟動於 port ${PORT}`);
});
```

### LINE Bot Webhook (src/routes/linebot.js)

```javascript
const express = require('express');
const crypto = require('crypto');
const { translateText } = require('../services/translator');

const router = express.Router();
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET;

// 使用者設定儲存 (生產環境建議用 Redis)
const userSettings = new Map();

// 驗證 LINE Signature
function validateSignature(body, signature) {
    const hash = crypto
        .createHmac('sha256', LINE_SECRET)
        .update(body)
        .digest('base64');
    return hash === signature;
}

// 回覆訊息
async function replyMessage(replyToken, messages) {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_TOKEN}`
        },
        body: JSON.stringify({ replyToken, messages })
    });
    return response.json();
}

// Webhook 處理
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-line-signature'];
    
    if (!validateSignature(req.body, signature)) {
        return res.status(403).send('Invalid signature');
    }

    const body = JSON.parse(req.body);
    
    for (const event of body.events) {
        if (event.type === 'message') {
            await handleMessage(event);
        }
    }
    
    res.status(200).send('OK');
});

// 處理訊息
async function handleMessage(event) {
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    
    // 取得使用者設定，預設中文→英文
    const settings = userSettings.get(userId) || { from: 'zh-TW', to: 'en' };
    
    if (event.message.type === 'text') {
        const text = event.message.text;
        
        // 檢查是否為指令
        if (text.startsWith('/')) {
            await handleCommand(replyToken, userId, text);
            return;
        }
        
        // 翻譯文字
        const result = await translateText(text, settings.from, settings.to);
        
        await replyMessage(replyToken, [
            { type: 'text', text: `🌏 ${result.translated}` },
            { type: 'text', text: `🗣️ 原文: ${text}` }
        ]);
    }
    
    if (event.message.type === 'audio') {
        // 處理語音訊息
        await replyMessage(replyToken, [
            { type: 'text', text: '🎤 語音翻譯功能開發中...' }
        ]);
    }
}

// 處理指令
async function handleCommand(replyToken, userId, text) {
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    
    switch (command) {
        case '/語言':
            await replyMessage(replyToken, [{
                type: 'text',
                text: `🌏 支援語言列表：
                
🇹🇼 中文(繁) | 🇨🇳 中文(簡) | 🇺🇸 英文
🇯🇵 日文 | 🇰🇷 韓文 | 🇪🇸 西班牙文
🇫🇷 法文 | 🇩🇪 德文 | 🇮🇹 義大利文
🇵🇹 葡萄牙文 | 🇷🇺 俄文 | 🇳🇱 荷蘭文
🇹🇭 泰文 | 🇻🇳 越南文 | 🇮🇩 印尼文
🇮🇳 印地文 | 🇸🇦 阿拉伯文 | 🇮🇱 希伯來文
🇹🇷 土耳其文 | 🇵🇱 波蘭文`
            }]);
            break;
            
        case '/設定':
            // 簡化設定邏輯
            await replyMessage(replyToken, [{
                type: 'text',
                text: '✅ 翻譯方向已更新！'
            }]);
            break;
            
        case '/交換':
            const settings = userSettings.get(userId) || { from: 'zh-TW', to: 'en' };
            userSettings.set(userId, { from: settings.to, to: settings.from });
            await replyMessage(replyToken, [{
                type: 'text',
                text: `🔄 翻譯方向已交換！`
            }]);
            break;
            
        default:
            await replyMessage(replyToken, [{
                type: 'text',
                text: `📖 使用說明：
                
直接輸入文字即可翻譯！

指令列表：
/語言 - 查看支援語言
/設定 中文 英文 - 設定翻譯方向
/交換 - 交換翻譯方向
/說明 - 顯示此說明

🎤 也可以直接傳送語音訊息！`
            }]);
    }
}

module.exports = router;
```

### 翻譯服務 (src/services/translator.js)

```javascript
const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

// 語言代碼對照表
const langCodes = {
    'zh-TW': { google: 'zh-TW', deepl: 'ZH' },
    'zh-CN': { google: 'zh-CN', deepl: 'ZH' },
    'en': { google: 'en', deepl: 'EN' },
    'ja': { google: 'ja', deepl: 'JA' },
    'ko': { google: 'ko', deepl: 'KO' },
    'es': { google: 'es', deepl: 'ES' },
    'fr': { google: 'fr', deepl: 'FR' },
    'de': { google: 'de', deepl: 'DE' },
    // ... 其他語言
};

// Google 翻譯
async function googleTranslate(text, from, to) {
    const url = `https://translation.googleapis.com/language/translate/v2`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            q: text,
            source: from,
            target: to,
            key: GOOGLE_API_KEY
        })
    });
    
    const data = await response.json();
    return data.data.translations[0].translatedText;
}

// DeepL 翻譯 (歐洲語系更準)
async function deeplTranslate(text, from, to) {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: [text],
            source_lang: langCodes[from]?.deepl,
            target_lang: langCodes[to]?.deepl
        })
    });
    
    const data = await response.json();
    return data.translations[0].text;
}

// 主翻譯函數 (自動選擇最佳 API)
async function translateText(text, from, to) {
    try {
        // 歐洲語系優先用 DeepL
        const europeanLangs = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ru'];
        
        if (DEEPL_API_KEY && europeanLangs.includes(to)) {
            const translated = await deeplTranslate(text, from, to);
            return { translated, engine: 'deepl' };
        }
        
        // 其他用 Google
        const translated = await googleTranslate(text, from, to);
        return { translated, engine: 'google' };
        
    } catch (error) {
        console.error('翻譯錯誤:', error);
        throw error;
    }
}

module.exports = { translateText, googleTranslate, deeplTranslate };
```

---

## 🚀 部署步驟

### 1. Railway 部署

```bash
# 1. 安裝 Railway CLI
npm install -g @railway/cli

# 2. 登入
railway login

# 3. 初始化專案
railway init

# 4. 設定環境變數
railway variables set LINE_CHANNEL_ACCESS_TOKEN=xxx
railway variables set LINE_CHANNEL_SECRET=xxx
railway variables set GOOGLE_TRANSLATE_API_KEY=xxx

# 5. 部署
railway up

# 6. 取得網址
railway domain
```

### 2. LINE Bot 設定

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 建立 Provider 和 Messaging API Channel
3. 取得 **Channel Access Token** 和 **Channel Secret**
4. 設定 **Webhook URL**: `https://你的railway網址/webhook/line`
5. 開啟 **Use webhook**
6. 關閉 **Auto-reply messages**

### 3. LINE 官方帳號設定

1. 前往 [LINE Official Account Manager](https://manager.line.biz/)
2. 設定問候語、自動回應
3. 加入好友 QR Code

---

## 📱 PWA 安裝指南

### iOS (Safari)
1. 開啟網站
2. 點擊「分享」按鈕
3. 選擇「加入主畫面」

### Android (Chrome)
1. 開啟網站
2. 點擊「更多選項」(⋮)
3. 選擇「新增至主畫面」

---

## 🎯 功能優先級

### Phase 1 (MVP)
- [x] 開機動畫
- [x] 基本 UI 框架
- [ ] 文字翻譯 API
- [ ] LINE Bot 文字翻譯
- [ ] Railway 部署

### Phase 2
- [ ] Web Speech API 語音辨識
- [ ] TTS 語音播放
- [ ] 翻譯歷史記錄
- [ ] LINE Bot 語音訊息

### Phase 3
- [ ] 離線翻譯快取
- [ ] 常用片語庫
- [ ] 多人對話模式
- [ ] 圖片 OCR 翻譯

---

## 📞 技術支援

如有問題，請檢查：
1. Railway 日誌: `railway logs`
2. LINE Bot Webhook 狀態
3. API Key 是否正確設定
