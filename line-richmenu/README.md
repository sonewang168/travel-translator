# LINE Bot 圖文選單設定指南

## 📐 圖文選單規格

| 項目 | 規格 |
|-----|------|
| 尺寸 | 2500 x 1686 像素 |
| 格式 | PNG 或 JPEG |
| 檔案大小 | 最大 1MB |
| 佈局 | 3 欄 x 2 列 (6 格) |

---

## 🎨 產生圖文選單圖片

### 方法 1：使用 SVG 檔案

1. 開啟 `richmenu.svg` 檔案（用瀏覽器或 Figma）
2. 截圖或匯出成 PNG（2500x1686）
3. 確保檔案小於 1MB

### 方法 2：使用 HTML 設計

1. 開啟 `richmenu-design.html`
2. 用瀏覽器開啟
3. 使用開發者工具截圖（設定尺寸 2500x1686）

---

## 🚀 上傳圖文選單到 LINE

### 使用 LINE Official Account Manager

1. 前往 [LINE Official Account Manager](https://manager.line.biz/)
2. 選擇你的帳號
3. 左側選單 → **圖文選單**
4. 點擊 **建立**
5. 上傳圖片並設定點擊動作

### 使用 API 設定（進階）

```bash
# 1. 建立圖文選單
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer {YOUR_CHANNEL_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @richmenu-config.json

# 回應會給你 richMenuId，例如：richmenu-xxxxxxxx

# 2. 上傳圖片
curl -X POST https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content \
  -H "Authorization: Bearer {YOUR_CHANNEL_ACCESS_TOKEN}" \
  -H "Content-Type: image/png" \
  --data-binary @richmenu.png

# 3. 設為預設選單
curl -X POST https://api.line.me/v2/bot/user/all/richmenu/{richMenuId} \
  -H "Authorization: Bearer {YOUR_CHANNEL_ACCESS_TOKEN}"
```

---

## 📱 6 格功能對應

| 位置 | 圖示 | 功能 | 觸發訊息 |
|-----|------|------|---------|
| 左上 | 🎤 | 語音翻譯 | `🎤 語音翻譯` |
| 中上 | ⌨️ | 文字翻譯 | `⌨️ 文字翻譯` |
| 右上 | 🌏 | 切換語言 | `/語言` |
| 左下 | 💬 | 常用句 | `/常用句` |
| 中下 | 📜 | 翻譯歷史 | `/歷史` |
| 右下 | ❓ | 使用說明 | `/說明` |

---

## 🎯 按鈕區域座標

```
┌────────────┬────────────┬────────────┐
│   0-833    │  833-1667  │ 1667-2500  │
│   0-843    │   0-843    │   0-843    │
│   語音翻譯  │  文字翻譯   │  切換語言   │
├────────────┼────────────┼────────────┤
│   0-833    │  833-1667  │ 1667-2500  │
│  843-1686  │  843-1686  │  843-1686  │
│   常用句   │  翻譯歷史   │  使用說明   │
└────────────┴────────────┴────────────┘
```

---

## 🔧 LINE Bot 新增指令

需要在 `linebot.js` 中處理這些新指令：

```javascript
// /常用句 - 顯示常用旅遊句子
case '/常用句':
    await replyMessage(replyToken, [{
        type: 'text',
        text: `🗣️ 旅遊常用句：

【問路】
請問...在哪裡？
這裡離...有多遠？

【用餐】
請給我菜單
這個多少錢？
我要這個

【購物】
可以便宜一點嗎？
可以刷卡嗎？

【緊急】
請幫助我
我需要醫生`
    }]);
    break;

// /歷史 - 顯示翻譯歷史
case '/歷史':
    // 從資料庫取得使用者歷史
    await replyMessage(replyToken, [{
        type: 'text',
        text: `📜 最近翻譯記錄：\n\n（功能開發中）`
    }]);
    break;
```

---

## 🎨 設計風格

- **主題**：賽博龐克 (Cyberpunk)
- **主色調**：
  - 青色 `#05d9e8`
  - 粉紅 `#ff2a6d`
  - 紫色 `#d300c5`
  - 綠色 `#01ff70`
  - 黃色 `#f9f002`
- **背景**：深色漸層 `#0a0a0f` → `#1a1a2e`
- **特效**：霓虹光暈、網格背景、角落裝飾
