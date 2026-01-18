# 🌏 旅遊~即時翻譯

賽博龐克風格的多語言即時翻譯 PWA + LINE Bot

![PWA](https://img.shields.io/badge/PWA-Ready-blue)
![Languages](https://img.shields.io/badge/Languages-22-green)
![LINE Bot](https://img.shields.io/badge/LINE-Bot-00C300)

## ✨ 功能特色

- 🎤 **語音翻譯** - Web Speech API + OpenAI Whisper 即時語音辨識
- ⌨️ **文字翻譯** - 支援 22 種語言互譯
- 🔄 **自動偵測** - 智慧偵測輸入語言
- 📱 **PWA 支援** - 可安裝至手機主畫面
- 🤖 **LINE Bot** - 整合 LINE 官方帳號，支援語音訊息翻譯
- 🎨 **賽博龐克風格** - 炫酷霓虹 UI 設計

## 🌐 支援語言 (22種)

| 類別 | 語言 |
|-----|------|
| **台灣** | 繁體中文、台語(閩南語)、客家語 |
| **亞洲** | 簡體中文、日文、韓文、泰文、越南文、印尼文 |
| **歐洲** | 英文、西班牙文、法文、德文、義大利文、葡萄牙文、俄文、荷蘭文、波蘭文 |
| **其他** | 阿拉伯文、希伯來文、土耳其文、印地文 |

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env` 檔案：

```env
# 翻譯 API (至少設定一個)
GOOGLE_TRANSLATE_API_KEY=your_google_api_key
DEEPL_API_KEY=your_deepl_api_key

# LINE Bot (選填)
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
```

### 3. 啟動伺服器

```bash
npm start
```

伺服器啟動於 `http://localhost:8080`

## 📱 PWA 安裝

### iPhone
1. Safari 開啟網站
2. 點擊「分享」按鈕
3. 選擇「加入主畫面」

### Android
1. Chrome 開啟網站
2. 點擊選單 → 「安裝應用程式」

## 🤖 LINE Bot 設定

### 1. 建立 LINE 官方帳號
- 前往 [LINE Developers](https://developers.line.biz/)
- 建立 Messaging API Channel

### 2. 設定 Webhook
- Webhook URL: `https://your-domain.railway.app/line`
- 開啟 Webhook
- 關閉自動回應訊息

### 3. 設定圖文選單
- 使用 `line-richmenu/richmenu-1x.png` (978KB)
- 設定 6 格點擊動作：

| 格子 | 傳送訊息 |
|-----|---------|
| 語音翻譯 | `語音翻譯` |
| 文字翻譯 | `文字翻譯` |
| 切換語言 | `切換語言` |
| 常用句 | `常用句` |
| 翻譯歷史 | `翻譯歷史` |
| 使用說明 | `使用說明` |

### 4. LINE Bot 指令

| 指令 | 功能 |
|-----|------|
| 直接輸入文字 | 自動翻譯 |
| `中日` `中韓` `中英` | 快速切換語言 |
| `中台` `中客` | 切換台語/客語 |
| `/設定 中文 日文` | 設定翻譯方向 |
| `/交換` | 交換翻譯方向 |
| `/語言` | 查看支援語言 |
| `/說明` | 使用說明 |

## 🚂 Railway 部署

### 方法 1: GitHub 連結 (推薦)

1. Push 到 GitHub
```bash
git add .
git commit -m "deploy"
git push
```

2. Railway Dashboard 連結 GitHub repo
3. 自動部署

### 方法 2: Railway CLI

```bash
railway login
railway link
railway up
```

### 環境變數設定

在 Railway Dashboard → Variables 設定：

```
GOOGLE_TRANSLATE_API_KEY=xxx
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx
```

## 📁 專案結構

```
travel-translator/
├── public/
│   ├── index.html      # PWA 主頁面
│   ├── manifest.json   # PWA 設定
│   └── sw.js           # Service Worker
├── src/
│   ├── index.js        # Express 伺服器
│   ├── routes/
│   │   ├── translate.js  # 翻譯 API
│   │   └── linebot.js    # LINE Bot Webhook
│   └── services/
│       └── translator.js # 翻譯服務
├── line-richmenu/
│   ├── richmenu-1x.png   # LINE 圖文選單 (978KB)
│   ├── richmenu-2x.png   # 高清版 (2.4MB)
│   ├── richmenu-v3.svg   # 原始 SVG
│   └── richmenu-config.json # 選單設定
├── .env.example
├── package.json
├── railway.json
└── README.md
```

## 🔧 API 說明

### 翻譯 API

```
POST /api/translate
Content-Type: application/json

{
  "text": "你好",
  "from": "zh-TW",
  "to": "en"
}

Response:
{
  "success": true,
  "translated": "Hello",
  "engine": "google"
}
```

### 翻譯引擎優先順序

1. **DeepL** - 歐洲語系優先
2. **Google Translate** - 主要翻譯引擎
3. **MyMemory** - 免費備用

## ⚠️ 台語/客語限制

由於主流翻譯 API 不直接支援台語/客語：

| 方向 | 處理方式 |
|-----|---------|
| 台語/客語 → 外語 | 系統辨識後翻譯 |
| 外語 → 台語/客語 | 翻譯成繁體中文 + 提示 |

## 🎨 設計風格

- **主題**: 賽博龐克 Cyberpunk
- **配色**: 
  - 青色 `#05d9e8`
  - 粉紅 `#ff2a6d`
  - 紫色 `#d300c5`
  - 綠色 `#01ff70`
  - 黃色 `#f9f002`
- **特效**: 霓虹光暈、網格背景、3D 開機動畫

## 📄 授權

MIT License

## 👨‍💻 作者

Sone Wang

---

🌏 **旅遊~即時翻譯** - 讓語言不再是旅行的障礙！
