const fetch = require('node-fetch');
const FormData = require('form-data');

// 取得 API Key 並移除多餘空白
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

/**
 * 使用 OpenAI Whisper API 進行語音轉文字
 * @param {Buffer} audioBuffer - 音檔 Buffer
 * @param {string} filename - 檔案名稱 (如 audio.m4a)
 * @returns {Promise<{text: string, language: string}>}
 */
async function transcribeAudio(audioBuffer, filename = 'audio.m4a') {
    if (!OPENAI_API_KEY) {
        throw new Error('未設定 OPENAI_API_KEY');
    }
    
    console.log(`Whisper 語音辨識: ${filename}, 大小: ${audioBuffer.length} bytes`);
    
    const formData = new FormData();
    formData.append('file', audioBuffer, {
        filename: filename,
        contentType: 'audio/m4a'
    });
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    
    // 提示詞，幫助辨識繁體中文
    formData.append('prompt', '請使用繁體中文。這是一段旅遊相關的對話。');
    
    try {
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error('Whisper API 錯誤:', error);
            throw new Error(`Whisper API 失敗: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Whisper 辨識結果:', data.text);
        
        return {
            text: data.text || '',
            language: data.language || 'unknown',
            duration: data.duration || 0
        };
        
    } catch (error) {
        console.error('Whisper 語音辨識失敗:', error.message);
        throw error;
    }
}

/**
 * Whisper 語言代碼對照
 */
const whisperLangMap = {
    'chinese': 'zh-TW',
    'english': 'en',
    'japanese': 'ja',
    'korean': 'ko',
    'thai': 'th',
    'vietnamese': 'vi',
    'french': 'fr',
    'german': 'de',
    'spanish': 'es',
    'italian': 'it',
    'portuguese': 'pt',
    'russian': 'ru',
    'arabic': 'ar',
    'turkish': 'tr',
    'indonesian': 'id'
};

/**
 * 將 Whisper 偵測的語言轉換為我們的語言代碼
 */
function mapWhisperLanguage(whisperLang) {
    return whisperLangMap[whisperLang?.toLowerCase()] || 'zh-TW';
}

module.exports = {
    transcribeAudio,
    mapWhisperLanguage
};
