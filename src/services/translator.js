const fetch = require('node-fetch');

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

// 語言代碼對照表
const langCodes = {
    'zh-TW': { google: 'zh-TW', deepl: 'ZH', name: '繁體中文' },
    'zh-CN': { google: 'zh-CN', deepl: 'ZH', name: '簡體中文' },
    'nan-TW': { google: 'zh-TW', deepl: 'ZH', name: '台語(閩南語)', isTaiwanese: true },
    'hak-TW': { google: 'zh-TW', deepl: 'ZH', name: '客家語', isHakka: true },
    'en': { google: 'en', deepl: 'EN', name: '英文' },
    'ja': { google: 'ja', deepl: 'JA', name: '日文' },
    'ko': { google: 'ko', deepl: 'KO', name: '韓文' },
    'es': { google: 'es', deepl: 'ES', name: '西班牙文' },
    'fr': { google: 'fr', deepl: 'FR', name: '法文' },
    'de': { google: 'de', deepl: 'DE', name: '德文' },
    'it': { google: 'it', deepl: 'IT', name: '義大利文' },
    'pt': { google: 'pt', deepl: 'PT', name: '葡萄牙文' },
    'ru': { google: 'ru', deepl: 'RU', name: '俄文' },
    'nl': { google: 'nl', deepl: 'NL', name: '荷蘭文' },
    'pl': { google: 'pl', deepl: 'PL', name: '波蘭文' },
    'th': { google: 'th', deepl: null, name: '泰文' },
    'vi': { google: 'vi', deepl: null, name: '越南文' },
    'id': { google: 'id', deepl: 'ID', name: '印尼文' },
    'hi': { google: 'hi', deepl: null, name: '印地文' },
    'ar': { google: 'ar', deepl: 'AR', name: '阿拉伯文' },
    'he': { google: 'he', deepl: null, name: '希伯來文' },
    'tr': { google: 'tr', deepl: 'TR', name: '土耳其文' }
};

/**
 * Google 翻譯
 */
async function googleTranslate(text, from, to) {
    if (!GOOGLE_API_KEY) {
        throw new Error('未設定 GOOGLE_TRANSLATE_API_KEY');
    }
    
    const url = 'https://translation.googleapis.com/language/translate/v2';
    const fromCode = langCodes[from]?.google || from;
    const toCode = langCodes[to]?.google || to;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            q: text,
            source: fromCode,
            target: toCode,
            key: GOOGLE_API_KEY
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google 翻譯失敗: ${error}`);
    }
    
    const data = await response.json();
    return data.data.translations[0].translatedText;
}

/**
 * DeepL 翻譯 (歐洲語系更精準)
 */
async function deeplTranslate(text, from, to) {
    if (!DEEPL_API_KEY) {
        throw new Error('未設定 DEEPL_API_KEY');
    }
    
    const fromCode = langCodes[from]?.deepl;
    const toCode = langCodes[to]?.deepl;
    
    if (!fromCode || !toCode) {
        throw new Error('DeepL 不支援此語言');
    }
    
    // 判斷是免費版還是付費版 API
    const apiUrl = DEEPL_API_KEY.endsWith(':fx') 
        ? 'https://api-free.deepl.com/v2/translate'
        : 'https://api.deepl.com/v2/translate';
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: [text],
            source_lang: fromCode,
            target_lang: toCode
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepL 翻譯失敗: ${error}`);
    }
    
    const data = await response.json();
    return data.translations[0].text;
}

/**
 * 免費備用翻譯 (MyMemory)
 */
async function freeTranslate(text, from, to) {
    const fromCode = langCodes[from]?.google || from;
    const toCode = langCodes[to]?.google || to;
    
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromCode}|${toCode}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error('免費翻譯服務失敗');
    }
    
    const data = await response.json();
    
    if (data.responseStatus !== 200) {
        throw new Error(data.responseDetails || '翻譯失敗');
    }
    
    return data.responseData.translatedText;
}

/**
 * 主翻譯函數 (自動選擇最佳 API + 台語客語特殊處理)
 */
async function translateText(text, from, to) {
    if (!text || !from || !to) {
        throw new Error('缺少必要參數');
    }
    
    console.log(`翻譯: "${text}" (${from} -> ${to})`);
    
    // 特殊處理：台語或客語
    const fromLang = langCodes[from];
    const toLang = langCodes[to];
    
    // 台語/客語 → 其他語言：當作繁體中文處理
    let actualFrom = from;
    let actualTo = to;
    
    if (fromLang?.isTaiwanese || fromLang?.isHakka) {
        actualFrom = 'zh-TW';
    }
    
    // 其他語言 → 台語/客語：翻譯成繁體中文
    if (toLang?.isTaiwanese || toLang?.isHakka) {
        actualTo = 'zh-TW';
    }
    
    // 如果來源和目標相同（例如台語翻客語），直接返回原文
    if (actualFrom === actualTo) {
        let result = text;
        if (toLang?.isTaiwanese) {
            result = text + '\n\n💡 台語發音請參考中文';
        } else if (toLang?.isHakka) {
            result = text + '\n\n💡 客語發音請參考中文';
        }
        return { translated: result, engine: 'direct' };
    }
    
    // 歐洲語系優先使用 DeepL
    const europeanLangs = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'ru'];
    const useDeepL = DEEPL_API_KEY && 
                     europeanLangs.includes(actualTo) && 
                     langCodes[actualFrom]?.deepl && 
                     langCodes[actualTo]?.deepl;
    
    try {
        let translated;
        let engine;
        
        // 優先順序: DeepL > Google > Free
        if (useDeepL) {
            try {
                translated = await deeplTranslate(text, actualFrom, actualTo);
                engine = 'deepl';
                console.log(`DeepL 翻譯結果: "${translated}"`);
            } catch (e) {
                console.log('DeepL 失敗，改用 Google:', e.message);
            }
        }
        
        if (!translated && GOOGLE_API_KEY) {
            try {
                translated = await googleTranslate(text, actualFrom, actualTo);
                engine = 'google';
                console.log(`Google 翻譯結果: "${translated}"`);
            } catch (e) {
                console.log('Google 失敗，改用免費服務:', e.message);
            }
        }
        
        if (!translated) {
            translated = await freeTranslate(text, actualFrom, actualTo);
            engine = 'mymemory';
            console.log(`免費翻譯結果: "${translated}"`);
        }
        
        // 如果目標是台語/客語，加上提示
        if (toLang?.isTaiwanese) {
            translated = translated + '\n\n💡 (已翻譯成中文，台語發音請參考)';
        } else if (toLang?.isHakka) {
            translated = translated + '\n\n💡 (已翻譯成中文，客語發音請參考)';
        }
        
        return { translated, engine };
        
    } catch (error) {
        console.error('所有翻譯服務都失敗:', error);
        throw new Error('翻譯服務暫時無法使用');
    }
}

module.exports = { 
    translateText, 
    googleTranslate, 
    deeplTranslate, 
    freeTranslate,
    langCodes 
};
