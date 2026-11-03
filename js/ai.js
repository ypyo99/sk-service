// ==========================================
// Gemini AI 실시간 덕담 & 성경구절 추천 모듈
// ==========================================

const GEMINI_API_KEY_STORAGE = 'GEMINI_API_KEY';
const DEFAULT_GEMINI_API_KEY = ''; // 하드코딩 배제: 사용자 직접 입력값만 안전하게 사용

// Gemini 모델 목록 (앞에서부터 시도, 실패 시 다음 모델)
// ※ 2.0-flash / 1.5-flash / 2.0-flash-lite 는 서비스 종료, 2.5-flash 는 신규 사용 불가 (2026-11 기준)
const GEMINI_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-2.5-flash-lite'
];

// 오프라인 / API 키 미등록 또는 오류 시 순환 표시할 성가대 맞춤 덕담 프리셋 라이브러리
const CHOIR_PRESET_QUOTES = [
    {
        theme: "정성과 감사의 찬양",
        service1: "이른 아침 일찍 나와 정성껏 찬양해 주셔서 정말 감사해요!",
        service2: "오늘 찬양이 참 좋아서 마음에 큰 감동과 힘이 돼요!"
    },
    {
        theme: "새벽을 깨우는 거룩한 찬양",
        service1: "아침 첫 시간을 아름다운 화음으로 열어주셔서 예배에 큰 힘이 돼요!",
        service2: "풍성한 화음과 정성 어린 찬양 덕분에 온 성도가 큰 은혜를 받았어요!"
    },
    {
        theme: "예배를 빛내는 기쁨의 화음",
        service1: "새벽 공기를 가르고 오셔서 올려주신 찬양이 성도들의 마음에 큰 감동을 주었어요!",
        service2: "한 주간 기도하며 열심히 준비해 주신 찬양이 예배를 더욱 빛나게 해 주었어요!"
    },
    {
        theme: "밝은 미소와 헌신의 울림",
        service1: "지휘자님, 반주자님, 대원들의 밝은 미소 덕분에 아침 예배가 더욱 밝아졌어요!",
        service2: "마음을 울리는 거룩한 찬양으로 하나님께 큰 영광 돌려주셔서 감사해요!"
    },
    {
        theme: "하늘의 은혜가 넘치는 찬양",
        service1: "아침 일찍 연습하시느라 고생 많으셨어요, 오늘 찬양 최고였어요!",
        service2: "성가대원들의 헌신적인 찬양이 우리 교회의 가장 큰 기쁨이자 자랑이에요!"
    },
    {
        theme: "평안과 위로를 주는 하모니",
        service1: "이른 아침 목소리를 모아 주님을 찬양하는 손길에 하나님의 복이 넘치길 바라요!",
        service2: "성가대원들의 밝은 미소와 화음 덕분에 우리 예배가 더욱 은혜로워져요!"
    },
    {
        theme: "영혼을 울리는 은혜의 소리",
        service1: "주일 첫 예배를 감동적인 하모니로 따뜻하게 감싸주셔서 감사해요!",
        service2: "가슴 뭉클한 찬양 소리에 한 주간의 모든 피로가 씻은 듯 사라졌어요!"
    }
];

// 하단 '자주 쓰는 따뜻한 한마디' 순환 라이브러리 (18선)
const SHORT_CHOIR_QUOTES = [
    "이른 아침 피로를 잊게 하는 환한 미소, 정말 최고였어요!",
    "지휘자님, 반주자님, 대원들의 호흡이 천상의 화음 같았어요!",
    "오늘 찬양 가사가 하루 종일 제 마음에 따뜻하게 맴돌 것 같아요!",
    "성가대원들의 정성 어린 헌신 덕분에 우리 예배가 배로 은혜로워져요!",
    "일주일 동안 지쳤던 마음에 큰 위로와 새 힘을 듬뿍 얻고 갑니다!",
    "주중에 기도하며 열심히 준비해 주신 그 마음이 가슴에 닿았어요!",
    "찬양대석의 밝은 표정을 보기만 해도 온 성도가 행복해집니다!",
    "아침 첫 예배의 문을 아름다운 찬양으로 열어주셔서 참 든든해요!",
    "귀한 목소리로 하나님께 큰 영광 돌려주신 수고를 진심으로 축복해요!",
    "마음을 울리는 거룩한 찬양으로 큰 은혜를 선물해 주셔서 감사해요!",
    "반주 선율과 대원들의 화음이 하나 된 모습이 정말 아름다웠어요!",
    "성가대의 찬양이 성도들의 기도와 마음에 든든한 날개를 달아주었어요!",
    "보이지 않는 곳에서 흘린 연습의 땀방울을 하나님께서 기뻐 받으실 거예요!",
    "오늘 찬양 덕분에 이번 한 주를 살아갈 큰 소망과 용기를 얻었습니다!",
    "맑고 고운 눈망울로 정성껏 찬양하는 모습에 가슴 깊이 감동받았어요!",
    "말씀 듣기 전 마음의 밭을 시원한 단비처럼 촉촉하게 적셔주셨어요!",
    "대원들의 한 목소리 하모니가 온 예배당을 포근하게 감싸 안아주었어요!",
    "한 주간 수고 많으셨어요, 오늘 찬양은 천사들의 노래 같았습니다!"
];

function getRandomShortChoirQuotes(count = 3) {
    const shuffled = [...SHORT_CHOIR_QUOTES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

function renderChoirExtras(extrasList) {
    const container = document.querySelector('.ceb-items');
    if (!container) return;
    const items = (Array.isArray(extrasList) && extrasList.length >= 3)
        ? extrasList.slice(0, 3)
        : getRandomShortChoirQuotes(3);
    
    container.innerHTML = items.map(text => 
        `<div class="ceb-item" onclick="copyTextDirect(this.textContent)">"${String(text).replace(/^"|"$/g, '').trim()}"</div>`
    ).join('');
}

// 내장 문구도 매번 같은 것부터 시작하지 않도록 무작위 시작
let currentChoirPresetIndex = Math.floor(Math.random() * CHOIR_PRESET_QUOTES.length);
let lastGeminiModel = '';

// API 키 가져오기 (오직 localStorage에 사용자가 등록한 값 사용, 공백/따옴표/줄바꿈 완벽 정제)
function getGeminiApiKey() {
    const raw = localStorage.getItem(GEMINI_API_KEY_STORAGE) || DEFAULT_GEMINI_API_KEY || '';
    return raw.replace(/["'\r\n\s]/g, '').trim();
}

// API 키 등록 상태 표시 갱신 (설정 화면)
function updateApiKeyButtons() {
    refreshSettingsStatus();
}

// API 키 입력 모달 열기
function openGeminiApiKeyModal() {
    buzz(8);
    const input = document.getElementById('geminiApiKeyInput');
    const statusText = document.getElementById('geminiKeyStatusText');
    const deleteBtn = document.getElementById('geminiKeyDeleteBtn');
    const eyeIcon = document.getElementById('apiKeyEyeIcon');

    const curKey = getGeminiApiKey();
    if (input) {
        input.value = curKey;
        input.type = 'password';
    }
    if (eyeIcon) eyeIcon.className = 'ph-bold ph-eye';

    if (statusText) {
        if (curKey) {
            statusText.textContent = '✅ 본인의 Gemini API 키가 기기에 안전하게 등록되어 있습니다.';
            statusText.style.color = '#059669';
        } else {
            statusText.textContent = '⚠️ API 키가 등록되지 않았습니다. Google AI Studio(aistudio.google.com)에서 발급받은 키를 입력하시면 실시간 AI 생성이 활성화됩니다.';
            statusText.style.color = '#d97706';
        }
    }

    if (deleteBtn) {
        deleteBtn.style.display = curKey ? 'inline-flex' : 'none';
    }

    openSheet('geminiKeyModal');
}

function closeGeminiApiKeyModal() {
    closeSheet('geminiKeyModal');
    refreshSettingsStatus();
}

// API 키 비밀번호 마스킹 가시성 토글
function toggleApiKeyVisibility() {
    const input = document.getElementById('geminiApiKeyInput');
    const icon = document.getElementById('apiKeyEyeIcon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'ph-bold ph-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'ph-bold ph-eye';
    }
}

// API 키 저장 (공백/따옴표/줄바꿈 완벽 정제)
function saveGeminiApiKey() {
    const input = document.getElementById('geminiApiKeyInput');
    const rawVal = (input ? input.value : '');
    const cleanKey = rawVal.replace(/["'\r\n\s]/g, '').trim();

    if (!cleanKey) {
        showToast('API 키를 입력해 주세요.', 'ph-warning');
        return;
    }
    localStorage.setItem(GEMINI_API_KEY_STORAGE, cleanKey);
    closeGeminiApiKeyModal();
    updateApiKeyButtons();
    showToast('Gemini API 키가 안전하게 저장되었습니다! ✨', 'ph-check-circle');

    // 열려 있는 모달에 맞추어 즉시 새로고침 실행
    const choirModal = document.getElementById('choirQuoteModal');
    if (choirModal && !choirModal.classList.contains('hidden')) {
        regenerateChoirQuotes();
    }
    const verseModal = document.getElementById('bibleVerseModal');
    if (verseModal && !verseModal.classList.contains('hidden')) {
        shuffleBibleVerse();
    }
}

// API 키 삭제
async function clearGeminiApiKey() {
    const ok = await appConfirm({
        title: 'API 키 삭제',
        desc: '등록된 Gemini API 키를 삭제할까요?\n삭제 후에는 기본 내장 문구로 동작합니다.',
        okText: '삭제',
        icon: 'ph-trash'
    });
    if (!ok) return;
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    const input = document.getElementById('geminiApiKeyInput');
    if (input) input.value = '';
    closeGeminiApiKeyModal();
    updateApiKeyButtons();
    showToast('API 키가 삭제되었습니다. (기본 프리셋으로 동작합니다)', 'ph-info');

    syncChoirModalTexts();
}

// 공통 Gemini REST API 호출 함수 (모델별 타임아웃, 높은 창의성 온도, JSON 응답 강제)
async function callGeminiApi(prompt, systemInstruction = '', timeoutMs = 8000, temperature = 1.15) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        const err = new Error('API 키가 설정되지 않았습니다.');
        err.code = 'NO_KEY';
        throw err;
    }

    let lastError = null;

    for (const model of GEMINI_MODELS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const reqBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: temperature,
                    // 사고(thinking) 토큰이 출력 한도를 먹어 답이 비거나 잘리지 않도록 넉넉히
                    maxOutputTokens: 1024,
                    responseMimeType: 'application/json'
                }
            };
            if (systemInstruction) {
                reqBody.systemInstruction = { parts: [{ text: systemInstruction }] };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(reqBody),
                signal: controller.signal
            });
            clearTimeout(timer);

            if (!res.ok) {
                let errMessage = '';
                try {
                    const errJson = await res.json();
                    errMessage = errJson?.error?.message || JSON.stringify(errJson);
                } catch (e) {
                    errMessage = await res.text();
                }
                console.error(`Gemini API [${model}] failed (${res.status}):`, errMessage);

                if (/API[ _]?key/i.test(errMessage) || res.status === 401) {
                    // 키가 잘못되었거나 만료되었거나 비활성화됨 → 다른 모델도 동일 키이므로 즉시 탈출
                    const err = new Error('API 키가 올바르지 않거나 권한이 없습니다. (Google AI Studio 키 확인)');
                    err.code = 'INVALID_KEY';
                    err.status = res.status;
                    throw err;
                } else if (res.status === 404 || res.status === 400 || res.status === 403) {
                    // 종료되었거나 이 키로 쓸 수 없는 모델 → 다음 모델 시도
                    lastError = new Error(`모델 [${model}] 사용 불가 (${res.status})`);
                } else if (res.status === 429) {
                    lastError = new Error('호출 한도(Quota)가 초과되었습니다. 잠시 후 다시 시도해 주세요.');
                    lastError.code = 'QUOTA_EXCEEDED';
                } else {
                    lastError = new Error(`모델 [${model}] 응답 오류 (${res.status})`);
                }
                continue;
            }

            const data = await res.json();
            // 사고 모델은 parts가 여러 개일 수 있어 thought가 아닌 텍스트만 모음
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const rawText = parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
            if (!rawText) {
                lastError = new Error('AI 응답 내용이 비어 있습니다.');
                continue;
            }

            lastGeminiModel = model;
            return rawText;
        } catch (netErr) {
            clearTimeout(timer);
            if (netErr.code === 'INVALID_KEY') throw netErr;
            if (netErr.name === 'AbortError') {
                console.warn(`Gemini model ${model} timed out after ${timeoutMs}ms, trying next...`);
                lastError = new Error(`모델 [${model}] 응답 시간 초과`);
                continue;
            }
            console.error(`Gemini model ${model} fetch exception:`, netErr);
            lastError = netErr;
        }
    }

    throw lastError || new Error('AI 모델 연결에 실패했습니다.');
}

// 텍스트에서 안전하게 JSON 파싱
function parseJsonFromText(rawText) {
    if (!rawText) return null;
    let text = rawText.replace(/```json\s*|```/gi, '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (match) text = match[0];
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn('JSON direct parse failed, trying regex fallback:', e);
        try {
            const s1Match = text.match(/"service1"\s*:\s*"([^"]+)"/);
            const s2Match = text.match(/"service2"\s*:\s*"([^"]+)"/);
            const themeMatch = text.match(/"theme"\s*:\s*"([^"]+)"/);
            if (s1Match && s2Match) {
                return {
                    service1: s1Match[1],
                    service2: s2Match[1],
                    theme: themeMatch ? themeMatch[1] : ''
                };
            }
        } catch (reErr) { }
        return null;
    }
}

// 성가대 덕담을 화면(성가대 창 + 첫째 주일 팝업)에 표시. source: 'ai' | 'preset'
function showChoirQuotes(data, source) {
    const clean = s => `"${String(s).replace(/^"|"$/g, '').trim()}"`;
    const isAI = source === 'ai';
    const targets = [['modalQuoteS1', data.service1], ['modalQuoteS2', data.service2],
                     ['quoteTextService1', data.service1], ['quoteTextService2', data.service2]];
    targets.forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = clean(text);
    });

    const badge = document.getElementById('choirModalBadge');
    if (badge) {
        badge.innerHTML = isAI
            ? '<i class="ph-bold ph-sparkle"></i> AI 추천 덕담'
            : '<i class="ph-bold ph-music-notes"></i> 성가대 격려 덕담 (기본 문구)';
    }
    const theme = document.getElementById('quoteThemeText');
    if (theme) {
        theme.innerHTML = isAI
            ? `<i class="ph-bold ph-sparkle"></i> AI 추천 덕담${data.theme ? ' · ' + esc(data.theme) : ''}`
            : '<i class="ph-bold ph-music-notes"></i> 기본 덕담';
    }

    // 하단 '자주 쓰는 따뜻한 한마디'도 함께 갱신하여 볼거리를 다양화
    renderChoirExtras(data ? data.extras : null);

    // 갱신 강조 애니메이션
    document.querySelectorAll('.choir-card, .quote-row').forEach(card => {
        card.classList.remove('updated-pulse');
        void card.offsetWidth; // 트리거 리플로우
        card.classList.add('updated-pulse');
    });
}

function choirTodayCacheKey() {
    const now = new Date();
    return 'gemini_choir_quote_' + `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getTodayChoirCache() {
    try {
        const key = choirTodayCacheKey();
        const cached = JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key));
        if (cached && cached.service1 && cached.service2) return cached;
    } catch (e) { }
    return null;
}

// 오늘 AI로 만든 덕담이 있으면 그것을, 없으면 내장 문구를 표시
function syncChoirModalTexts() {
    const cached = getTodayChoirCache();
    if (cached) showChoirQuotes(cached, 'ai');
    else showChoirQuotes(CHOIR_PRESET_QUOTES[currentChoirPresetIndex], 'preset');
}

function nextChoirPreset() {
    currentChoirPresetIndex = (currentChoirPresetIndex + 1) % CHOIR_PRESET_QUOTES.length;
    showChoirQuotes(CHOIR_PRESET_QUOTES[currentChoirPresetIndex], 'preset');
}

// 로딩 표시 (성가대 창 + 첫째 주일 팝업 공통)
function setChoirLoading(on) {
    const toggle = (id, hidden) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', hidden);
    };
    toggle('choirModalLoadingBox', !on);
    toggle('choirModalCards', on);
    toggle('quoteLoadingBox', !on);
    toggle('quoteQuotesContainer', on);
    ['choirModalRegenBtn', 'quoteRegenBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = on;
    });
}

// AI 덕담 생성 → 화면 반영. 실패하면 이유를 알리고 다음 내장 문구로 전환
let isGeneratingChoir = false;
async function refreshChoirQuotes(forceRefresh) {
    const hasKey = !!getGeminiApiKey();
    const noKeyBox = document.getElementById('quoteNoKeyBox');
    if (noKeyBox) noKeyBox.classList.toggle('hidden', hasKey);

    if (!hasKey) {
        if (forceRefresh) nextChoirPreset();
        else syncChoirModalTexts();
        return;
    }
    if (!forceRefresh && getTodayChoirCache()) {
        syncChoirModalTexts();
        return;
    }
    if (isGeneratingChoir) return;

    isGeneratingChoir = true;
    setChoirLoading(true);
    try {
        const result = await generateChoirQuotesAI(true);
        showChoirQuotes(result, 'ai');
        if (forceRefresh) showToast('새로운 AI 덕담이 생성되었습니다! ✨', 'ph-sparkle');
    } catch (err) {
        console.error('refreshChoirQuotes failed:', err);
        showToast(`AI 덕담 생성 실패: ${err?.message || 'AI 통신 실패'} (기본 문구 표시)`, 'ph-warning');
        nextChoirPreset();
    } finally {
        isGeneratingChoir = false;
        setChoirLoading(false);
    }
}

// 성가대 모달 열기: 오늘 덕담(또는 기본 문구)을 바로 보여주고, 오늘 AI 덕담이 없으면 생성
function openChoirModal() {
    buzz(8);
    syncChoirModalTexts();
    openSheet('choirQuoteModal');
    if (getGeminiApiKey() && !getTodayChoirCache()) refreshChoirQuotes(false);
}

function closeChoirQuoteModal() {
    closeSheet('choirQuoteModal');
}

function copyChoirQuote(id) {
    buzz(10);
    const el = document.getElementById(id);
    if (!el) return;
    copyTextDirect(el.textContent.trim());
}

function copyTextDirect(text) {
    buzz(10);
    let ok = false;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
            ok = true;
        }
    } catch (e) { }
    if (!ok && typeof legacyCopy === 'function') ok = legacyCopy(text);
    showToast('덕담 문구가 복사되었습니다! 🎵', 'ph-check');
}

// 성가대 덕담 '새 추천 (AI)' / 첫째 주일 '새로 생성' 버튼 핸들러
async function regenerateChoirQuotes() {
    buzz(10);
    if (!getGeminiApiKey()) {
        nextChoirPreset();
        showToast('Gemini API 키를 등록하면 AI가 새로운 덕담을 만듭니다. (설정 → Gemini AI 키)', 'ph-key');
        return;
    }
    await refreshChoirQuotes(true);
}

// 최근 생성한 덕담 히스토리 (직전 문장과의 중복 방지용)
const CHOIR_HISTORY_KEY = 'gemini_choir_quote_history';
function getChoirHistory() {
    try { return JSON.parse(localStorage.getItem(CHOIR_HISTORY_KEY) || '[]'); } catch (e) { return []; }
}
function pushChoirHistory(data) {
    try {
        const list = getChoirHistory();
        if (data.service1) list.push(data.service1.trim());
        if (data.service2) list.push(data.service2.trim());
        localStorage.setItem(CHOIR_HISTORY_KEY, JSON.stringify(list.slice(-12)));
    } catch (e) { }
}

// Gemini AI를 통한 실시간 맞춤 성가대 덕담 생성 (다양성 극대화, 중복 방지)
async function generateChoirQuotesAI(forceRefresh = false) {
    if (!getGeminiApiKey()) {
        const err = new Error('API 키가 설정되지 않았습니다.');
        err.code = 'NO_KEY';
        throw err;
    }

    // 이미 오늘 생성된 덕담이 있고 강제 새로고침이 아닌 경우 캐시 반환
    if (!forceRefresh) {
        const cached = getTodayChoirCache();
        if (cached) return cached;
    }

    // 매번 다른 각도와 주제로 신선한 덕담을 유도하는 50가지 다채로운 힌트 풀 (1부/2부 각 50개)
    const ANGLES_1 = [
        "이른 아침 피로를 단번에 잊게 해 준 찬양대의 밝고 환한 미소와 비타민 같은 에너지",
        "새벽 공기를 뚫고 가장 먼저 예배당을 거룩한 찬양으로 채워준 든든한 헌신",
        "주일 아침 첫 예배를 찾아온 성도들의 굳은 마음을 따뜻하게 녹여준 맑은 선율",
        "주일 첫 시간을 하나님께 온전히 구별하여 올려드린 거룩한 첫 열매의 감동",
        "지휘자의 섬세한 손짓과 반주자의 선율, 대원들의 숨소리가 하나 된 아름다운 앙상블",
        "아침 일찍 예배를 돕는 안내·봉사위원들에게도 큰 힘과 위로가 되어준 울림",
        "추위나 이른 시간의 수고를 기쁨과 감사로 바꿔준 감동적인 찬양",
        "예배당 문을 열자마자 울려 퍼진 찬양 소리에 큰 평안과 감동을 받은 순간",
        "소프라노, 알토, 테너, 베이스가 빚어낸 맑고 순수한 첫 화음의 감격",
        "바쁜 주말에도 아침 첫 시간을 기도로 준비하고 달려와 준 거룩한 발걸음",
        "설교 말씀 전 성도들의 마음 밭을 은혜의 단비처럼 촉촉하게 적셔준 찬양",
        "하루 종일 귓가에 맴돌며 미소 짓게 만들 것 같은 상쾌하고 다정한 멜로디",
        "아침 햇살처럼 어두운 마음을 환하게 비추며 소망을 샘솟게 해 준 고운 목소리",
        "남들보다 두세 시간 먼저 일어나 기도로 목을 풀고 찬양을 준비한 정성",
        "1부 예배의 고요한 침묵을 거룩한 찬미의 기쁨으로 깨워준 감격의 첫 소리",
        "졸린 눈을 반짝이며 하나님만 바라보고 부른 대원들의 순수하고 청아한 눈망울",
        "피곤한 주일 아침을 가장 활기차고 은혜로운 축제로 만들어준 감사의 노래",
        "이른 아침의 쌀쌀한 공기를 훈훈한 온기로 덮어준 포근한 하모니",
        "첫 예배 강단을 향해 온 정성을 다해 고백한 한 소절 한 소절의 깊은 진심",
        "한 주를 시작하는 성도들의 영혼에 생수 같은 쉼과 위로를 건넨 찬양",
        "어둠을 걷어내는 새벽 종소리처럼 청명하고 맑게 울려 퍼진 첫 찬미",
        "찬양대원 한 분 한 분의 얼굴에 피어난 천사 같은 미소가 준 벅찬 행복",
        "예배당 구석구석 빈자리까지 따스한 은혜로 가득 메워준 울림",
        "일찍 일어난 수고가 무색할 만큼 크고 놀라운 기쁨을 맛보게 해 준 찬양",
        "맑은 아침 이슬처럼 성도들의 영혼을 깨끗하게 씻어준 정갈한 선율",
        "졸음과 피로 대신 감사와 찬양으로 주일을 시작하게 해 준 영적 활력소",
        "주일 첫 예배의 영적 문을 활짝 열어젖힌 웅장하고 거룩한 찬송",
        "서로의 눈을 맞추며 하나의 호흡으로 빚어낸 아름다운 신앙의 화답",
        "바쁜 일상 속에서 가장 좋은 첫 시간을 주님께 드린 아름다운 헌신자들",
        "지친 몸으로 예배당에 들어선 성도들의 마음에 잔잔한 평안을 선물한 노래",
        "가슴 뭉클한 가사로 눈시울을 붉히게 한 이른 아침의 깊은 영성",
        "피아노의 맑은 터치와 대원들의 청아한 음색이 어우러진 천상의 멜로디",
        "예배당 가득 은혜의 향기를 피워 올린 1부 찬양대의 귀한 첫 제사",
        "하루의 첫 단추를 찬양과 감사로 꿰매어 준 고마운 대원들의 손길",
        "아침을 깨우는 새들의 노래보다 더 아름답고 고귀한 성도들의 찬양",
        "이른 시간에도 흐트러짐 없는 단정한 모습과 정성 어린 찬양의 자세",
        "온 교우들의 심령에 새 힘과 기쁨을 불어넣어 준 든든한 응원의 메아리",
        "주님을 향한 첫사랑의 설렘을 다시금 일깨워준 순수하고 맑은 화음",
        "주일 아침 가장 복된 자리를 지키며 축복의 통로가 되어준 거룩한 찬양",
        "찬양이 시작되자마자 온 마음에 번져간 형언할 수 없는 평안과 안식",
        "반주자와 지휘자, 대원들이 한마음으로 엮어낸 감동의 태피스트리",
        "첫 예배에 참석한 모든 이들의 입술에 감사를 머금게 한 환희의 찬가",
        "새벽 제단을 쌓듯 겸손한 무릎과 뜨거운 가슴으로 드린 첫 찬양",
        "성도들의 하루 전체를 은혜로 채워줄 든든한 영적 양식이 된 멜로디",
        "조용한 아침 예배당을 거룩한 기쁨으로 요동치게 한 힘 있는 찬양",
        "세상의 분주한 소음을 잠재우고 주님의 음성에 귀 기울이게 한 화음",
        "찬양대원들의 밝은 에너지가 온 성도들에게 전염되어 번져간 주일 아침",
        "첫 예배의 감격을 배나 더 풍성하게 만들어 준 보석 같은 목소리들",
        "주님 보좌 앞에 가장 먼저 향기로운 제물로 상달되었을 아름다운 고백",
        "주일 첫 시간을 하나님께 봉헌한 대원들의 복된 발걸음을 향한 찬사"
    ];

    const ANGLES_2 = [
        "온 성도의 마음에 큰 감동과 깊은 평안을 선물해 준 거룩한 찬양의 여운",
        "한 주간 삶의 무게와 피로를 씻은 듯 내려놓게 해 준 시원한 생수 같은 하모니",
        "가사 한 줄 한 줄이 마음에 깊이 새겨져 가슴 뭉클한 위로와 소망이 된 찬양",
        "한 주간 바쁜 생업 중에도 악보를 보며 열심히 연습한 땀방울이 느껴진 감동",
        "풍성하고 웅장한 화음으로 예배를 더욱 거룩하고 은혜롭게 빛내준 수고",
        "듣는 온 성도들의 얼굴에 절로 감사와 행복한 미소가 번지게 한 감격",
        "내일부터 세상으로 나아갈 성도들에게 든든한 방패와 새 힘이 되어준 찬양",
        "온 마음과 정성을 다해 주님께 영광 돌린 대원들의 귀한 헌신에 대한 칭찬",
        "마치 하늘 문이 활짝 열린 듯 가슴 벅찬 감동을 선물해 준 거룩한 울림",
        "성가대의 찬양이 성도들의 기도와 마음에 든든한 날개를 달아준 순간",
        "예배당 전체를 천국처럼 환하게 물들인 대원들의 하나 된 목소리",
        "찬양이 끝난 뒤에도 오랫동안 마음에 남아 잔잔한 감동을 주는 은혜",
        "예배당 지붕을 뚫고 하늘에 닿을 듯 힘차고 당당하게 울려 퍼진 찬양",
        "각 파트의 완벽한 밸런스와 조화로 빚어낸 웅장하고 깊이 있는 하모니",
        "고단했던 지난 한 주의 눈물과 상처를 어루만져 준 따뜻한 치유의 노래",
        "지휘봉 끝에서 터져 나온 성령의 감동과 대원들의 폭발적인 찬양 열정",
        "오케스트라와 피아노, 성가대가 하나 되어 쏟아낸 벅찬 은혜의 파도",
        "설교 말씀의 감동을 두 배로 끌어올려 준 준비된 영혼들의 거룩한 찬미",
        "세대를 아우르는 남녀 대원들의 목소리가 한데 섞여 빚어낸 황홀한 화음",
        "한 영혼 한 영혼의 가슴에 굵직한 결단과 믿음을 심어준 힘 있는 메시지",
        "주중의 바쁜 시간들을 쪼개어 연습실을 지킨 대원들의 땀과 눈물의 결실",
        "온 회중이 숨죽이며 몰입하게 만든 압도적이고 장엄한 찬양의 순간",
        "성가대의 고백이 온 교우들의 한마음 된 신앙고백이 되어 울려 퍼진 은혜",
        "거센 세상 풍파 속에서도 주님만 의지하겠다고 다짐하게 만든 용기의 멜로디",
        "맑은 고음과 든든한 저음이 만나 이뤄낸 감탄이 절로 나오는 환상적 앙상블",
        "지친 이들에게는 쉼을, 넘어진 이들에게는 다시 일어설 용기를 선물한 찬양",
        "예배당 가득 울려 퍼진 풍성한 소리가 성도들의 마음에 큰 울림을 준 시간",
        "대원들의 헌신적인 열정과 기도가 고스란히 묻어난 깊은 감동의 무대",
        "마치 천군 천사의 찬양대를 눈앞에서 마주한 듯 신비롭고 영광스러웠던 찬송",
        "주일 예배의 정점을 화려하고 거룩하게 수놓은 아름다운 목소리의 향연",
        "고단한 세상살이에 지쳐 있던 교우들의 영혼을 시원하게 적셔준 은혜의 소나기",
        "가사의 의미를 온몸으로 표현하며 하나님을 찬양한 대원들의 진솔한 고백",
        "찬양의 클라이맥스에서 온몸에 전율과 감동이 흐르게 한 벅찬 순간",
        "성도들의 무거운 어깨를 가볍게 해 준 따뜻한 사랑과 축복의 하모니",
        "서로 다른 음색들이 주 안에서 하나 되어 피워낸 가장 완벽한 꽃",
        "다음 한 주를 넉넉히 승리할 수 있도록 영적 갑주를 입혀준 힘찬 노래",
        "깊은 묵상과 영성으로 곡을 이끌어준 지휘자와 반주자의 훌륭한 헌신",
        "예배에 참석한 모든 이들에게 천국의 기쁨을 미리 맛보게 해 준 하모니",
        "오직 하나님께만 영광을 돌리고자 했던 대원들의 순전하고 겸손한 마음",
        "성가대의 웅장한 찬양 소리에 온 교회의 기도가 함께 실려 올라간 감격",
        "마음의 답답함과 염려를 단숨에 날려버린 능력 있고 은혜로운 찬미",
        "주일 2부 예배를 은혜의 바다로 이끌어준 최고의 찬양과 헌신",
        "함께 부르는 찬양이 얼마나 큰 위로와 능력이 되는지 깨닫게 해 준 시간",
        "찬양대원 한 사람 한 사람이 빛나는 영적 보석처럼 빛났던 은혜의 시간",
        "메마른 성도들의 심령에 단비를 내리듯 촉촉한 눈물을 머금게 한 찬양",
        "세상 어디에서도 들을 수 없는 가장 진실하고 거룩한 감동의 멜로디",
        "한 주간의 모든 근심을 잊고 오직 십자가의 은혜에만 젖어들게 한 울림",
        "화려한 기교보다 하나님을 향한 진심 어린 사랑이 먼저 전해진 하모니",
        "2부 예배를 거룩한 감동과 영광의 도가니로 몰아넣은 찬양대의 역작",
        "주님의 크신 위엄과 인자하심을 온몸으로 노래하여 성도들을 감동시킨 찬양"
    ];

    const TONES = [
        "시적이고 서정적인 감동 어투",
        "친구처럼 다정하고 경쾌한 감사의 어투",
        "진중하고 깊은 울림의 축복 어투",
        "비타민처럼 활력을 불어넣는 따뜻한 응원 어투"
    ];

    const now = new Date();
    const angle1 = ANGLES_1[Math.floor(Math.random() * ANGLES_1.length)];
    const angle2 = ANGLES_2[Math.floor(Math.random() * ANGLES_2.length)];
    const tone = TONES[Math.floor(Math.random() * TONES.length)];
    const randomNonce = Math.floor(Math.random() * 1000000);
    const month = now.getMonth() + 1;

    // 최근 나왔던 문장 최대 4개만 추출하여 해당 비유/표현 반복 차단
    const recentPhrases = getChoirHistory().slice(-4);
    let avoidNotice = '';
    if (recentPhrases.length > 0) {
        avoidNotice = `\n[주의: 직전에 이미 나왔던 문구이므로 아래 문구와 비유나 첫 단어가 겹치지 않는 완전히 새로운 표현으로 작성하세요]:\n` +
            recentPhrases.map(p => `- "${p}"`).join('\n') + '\n';
    }

    const prompt = `오늘 날짜는 ${now.getFullYear()}년 ${month}월입니다. 교회 예배부 사역자가 주일 예배 성가대원들에게 건넬 아주 쉽고 따뜻한 덕담(격려 문구)을 작성해 주세요. (고유코드: ${randomNonce})

[격려 초점]
- 1부 성가대: ${angle1}
- 2부 성가대: ${angle2}
- 표현 어조: ${tone}
${avoidNotice}
[작성 지침 - 절대 준수]
1. 글자수: 각 문장은 20자~42자 내외로, 너무 짧게 줄이지 말고 자연스럽고 정감 넘치는 1~2문장 구어체로 작성하세요.
2. 어휘: 초등학생부터 어르신까지 편안하게 공감할 수 있는 쉬운 일상 단어와 따뜻한 비유를 사용하세요. 거창하고 어려운 한자어('풍성케 하심', '화답하여', '심령' 등)는 절대 쓰지 마세요.
3. 어미: 부드럽고 다정한 존댓말(~감사해요, ~힘이 돼요, ~참 든든해요, ~감동이었어요, ~행복해져요 등)을 다채롭게 활용하세요.
4. 다양성: 기존의 뻔한 표현 대신, 오늘 주일의 분위기가 눈앞에 그려지는 생생하고 참신한 감동 표현을 담아주세요.
5. extras: 성가대원들에게 가볍게 건넬 수 있는 짧은 한마디(15~28자) 3개도 함께 작성하세요.

반드시 아래 JSON 형식으로만 응답해 주세요:
{
  "theme": "${month}월 찬양 감사",
  "service1": "1부 덕담 문구 (20~42자)",
  "service2": "2부 덕담 문구 (20~42자)",
  "extras": [
    "짧은 한마디 1 (15~28자)",
    "짧은 한마디 2 (15~28자)",
    "짧은 한마디 3 (15~28자)"
  ]
}`;

    // 창의성 온도 1.15로 높여 매번 완전히 참신한 문장 유도
    const rawText = await callGeminiApi(prompt, '', 8000, 1.15);
    const resultData = parseJsonFromText(rawText);

    if (resultData && resultData.service1 && resultData.service2) {
        try {
            const cacheKey = choirTodayCacheKey();
            localStorage.setItem(cacheKey, JSON.stringify(resultData));
            sessionStorage.setItem(cacheKey, JSON.stringify(resultData));
        } catch (e) { }
        pushChoirHistory(resultData);
        return resultData;
    }

    throw new Error('AI 덕담 응답 데이터 파싱 실패');
}

function copyQuote(elemId) {
    buzz(10);
    const elem = document.getElementById(elemId);
    if (!elem) return;
    copyTextDirect(elem.textContent.trim());
}

// ==========================================
// 성경구절 AI 추천 및 모달 로직
// ==========================================

let currentActiveVerse = null;
let currentBibleVerseIndex = -1;
let isFetchingVerseAI = false;

function getTodayVerseIndex() {
    const now = new Date();
    const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    return Math.abs(seed) % (BIBLE_VERSES.length || 100);
}

function renderCurrentVerseDisplay(item, isAI = false) {
    if (!item) return;
    currentActiveVerse = item;
    const textEl = document.getElementById('modalVerseText');
    const refEl = document.getElementById('modalVerseRef');
    const tagsEl = document.getElementById('modalVerseTags');
    const prayerEl = document.getElementById('modalVersePrayer');
    const badgeEl = document.getElementById('modalVerseBadge');

    if (textEl) textEl.textContent = `"${item.text.replace(/^"|"$/g, '').trim()}"`;
    if (refEl) refEl.textContent = `— ${item.ref.replace(/^—+|—+$/g, '').trim()} —`;
    if (prayerEl) prayerEl.textContent = item.prayer;
    if (tagsEl && item.tags && Array.isArray(item.tags)) {
        tagsEl.innerHTML = item.tags.map(t => `<span class="vtag">#${t}</span>`).join('');
    }
    if (badgeEl) {
        badgeEl.innerHTML = isAI
            ? '<i class="ph-bold ph-sparkle"></i> AI 추천 말씀'
            : '<i class="ph-bold ph-book-bookmark"></i> 추천 성경구절 (봉사·수고 칭찬)';
    }

    // 갱신 애니메이션
    const vcard = document.querySelector('.verse-card');
    if (vcard) {
        vcard.classList.remove('updated-pulse');
        void vcard.offsetWidth;
        vcard.classList.add('updated-pulse');
    }
}

// 예배위원 맞춤 성경구절 AI 추천 (0초 즉각 렌더링 + 초고속 0.8초 AI 생성)
async function fetchBibleVerseAI(forceRefresh = false) {
    const versesLib = BIBLE_VERSES; // data.js의 const 전역 (window 속성 아님)
    const apiKey = getGeminiApiKey();
    const shuffleBtn = document.getElementById('modalVerseShuffleBtn');
    const textEl = document.getElementById('modalVerseText');
    const refEl = document.getElementById('modalVerseRef');
    const tagsEl = document.getElementById('modalVerseTags');
    const prayerEl = document.getElementById('modalVersePrayer');

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cacheKey = 'gemini_verse_quote_' + todayKey;

    // 1. 모달 최초 오픈 시 (forceRefresh === false): 사용자 대기 시간 0초! 즉시 화면 렌더링
    if (!forceRefresh) {
        // (1) 오늘 생성된 캐시가 있으면 즉시 표시
        try {
            const cached = JSON.parse(sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey));
            if (cached && cached.text && cached.ref && cached.prayer) {
                renderCurrentVerseDisplay(cached, true);
                return;
            }
        } catch (e) { }

        // (2) 캐시가 아직 없더라도 로딩으로 기다리게 하지 않고 엄선된 오늘의 추천 말씀을 0초 만에 즉시 표시!
        if (currentBibleVerseIndex < 0) currentBibleVerseIndex = getTodayVerseIndex();
        const fallbackItem = versesLib[currentBibleVerseIndex] || versesLib[0];
        renderCurrentVerseDisplay(fallbackItem, false);

        // API 키가 없으면 오늘의 말씀 표시로 완료
        if (!apiKey) return;

        // API 키가 있으면 화면은 이미 보이고 있는 상태에서 백그라운드로 AI 생성을 시도하여 자연스럽게 갱신
        setTimeout(() => {
            fetchBibleVerseAI(true);
        }, 200);
        return;
    }

    // 2. 사용자가 '새 추천 (AI)' 버튼을 눌렀을 때 (forceRefresh === true):
    if (!apiKey) {
        currentBibleVerseIndex = (currentBibleVerseIndex + 1) % versesLib.length;
        const fallbackItem = versesLib[currentBibleVerseIndex] || versesLib[0];
        renderCurrentVerseDisplay(fallbackItem, false);
        showToast('새로운 추천 말씀으로 변경되었습니다! ✨', 'ph-sparkle');
        return;
    }

    // 실시간 AI 로딩 상태 표시
    isFetchingVerseAI = true;
    if (shuffleBtn) shuffleBtn.disabled = true;
    if (textEl) {
        textEl.innerHTML = '<span style="display:inline-flex; align-items:center; gap:8px; color:#b45309; font-size:15px;"><i class="ph-bold ph-spinner-gap spin" style="font-size:20px;"></i> AI가 맞춤 성경구절을 추천하고 있습니다...</span>';
    }
    if (refEl) refEl.textContent = '';
    if (tagsEl) tagsEl.innerHTML = '';
    if (prayerEl) prayerEl.innerHTML = '<span style="color:var(--muted); font-size:13px;">말씀과 함께 나눌 축복 기도문을 준비하고 있습니다...</span>';

    const VERSE_HISTORY_KEY = 'gemini_verse_recent_refs';
    function getVerseRecentRefs() {
        try { return JSON.parse(localStorage.getItem(VERSE_HISTORY_KEY) || '[]'); } catch (e) { return []; }
    }
    function pushVerseRef(ref) {
        try {
            const list = getVerseRecentRefs();
            if (ref) list.push(ref.trim());
            localStorage.setItem(VERSE_HISTORY_KEY, JSON.stringify(list.slice(-8)));
        } catch (e) { }
    }

    const VERSE_ANGLES = [
        "주일 아침 일찍 나와 보이지 않는 곳에서 묵묵히 헌신하는 예배위원의 봉사를 크게 칭찬하고 기억하시는 하나님의 은혜",
        "지치지 않고 기쁨으로 섬길 때 하나님께서 풍성한 상급과 평안을 예비해 두셨다는 격려와 축복",
        "성도들을 온 마음과 미소로 맞이하며 예배를 돕는 섬김의 손길에 부어주시는 하늘의 복",
        "하나님의 집에서 한 날 문지기로 섬김이 세상의 천 날보다 낫다는 감사와 거룩한 자부심 (시편 84편)",
        "사랑과 봉사로 하나 되어 주님의 몸 된 교회를 든든히 세워가는 거룩한 동역자들의 수고 칭찬",
        "선을 행하되 낙심하지 아니하면 때가 이르매 거두리라는 소망과 위로 (갈라디아서 6장)",
        "무슨 일을 하든지 마음을 다하여 주께 하듯 하고 사람에게 하듯 하지 말라는 영적 권면 (골로새서 3장)",
        "착하고 충성된 종아 네가 적은 일에 충성하였으매 내가 많은 것을 네게 맡기리니 (마태복음 25장)",
        "하나님은 불의하지 아니하사 너희 행위와 그의 이름을 위하여 나타낸 사랑을 잊지 않으신다는 위로 (히브리서 6장)",
        "각각 은사를 받은 대로 하나님의 여러 가지 은혜를 맡은 선한 청지기 같이 봉사하라 (베드로전서 4장)",
        "좋은 소식을 전하며 평화를 공포하며 복된 좋은 소식을 가져오는 자의 발이 어찌 그리 아름다운가 (이사야 52장)",
        "너희 수고가 주 안에서 헛되지 않은 줄 앎이라 흔들리지 말고 항상 주의 일에 더욱 힘쓰는 자들이 되라 (고전 15장)"
    ];
    const pickedAngle = VERSE_ANGLES[Math.floor(Math.random() * VERSE_ANGLES.length)];
    const randomNonce = Math.floor(Math.random() * 1000000);
    const recentRefs = getVerseRecentRefs();
    let avoidVerseNotice = '';
    if (recentRefs.length > 0) {
        avoidVerseNotice = `\n[주의: 최근에 이미 추천된 구절이므로 아래 구절은 피하고 성경 66권 중 아직 나오지 않은 다른 감동적인 구절을 추천하세요]:\n` +
            recentRefs.map(r => `- ${r}`).join('\n') + '\n';
    }

    // 프롬프트 압축 (토큰 처리 속도 및 생성 시간 극대화)
    const prompt = `교회 주일 아침 8시 30분 예배위원(안내/봉사/기도/방송실)들의 '봉사, 헌신, 수고'를 크게 칭찬하고 격려하는 성경구절 1개와 짧은 축복 기도문을 작성하세요. (코드:${randomNonce})
초점: ${pickedAngle}
${avoidVerseNotice}
[규칙]
1. text: 실제 개역개정 성경 본문 그대로 (봉사와 수고 칭찬 격려)
2. ref: 정확한 책 이름과 장절 (예: 시편 84편 10절)
3. tags: 핵심 태그 2개 배열
4. prayer: 예배위원을 축복하는 1줄 기도문 (~하옵소서)
5. 다양한 성경(시편, 잠언, 이사야, 복음서, 바울서신, 일반서신 등)에서 골고루 추천하세요.

반드시 아래 JSON 형식으로만 응답:
{
  "ref": "성경 출처",
  "text": "실제 본문",
  "tags": ["수고 칭찬", "은혜"],
  "prayer": "축복 기도문"
}`;

    try {
        const rawText = await callGeminiApi(prompt, '', 8000, 1.15);
        const resultData = parseJsonFromText(rawText);

        if (resultData && resultData.text && resultData.ref) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify(resultData));
                sessionStorage.setItem(cacheKey, JSON.stringify(resultData));
            } catch (e) { }

            pushVerseRef(resultData.ref);
            renderCurrentVerseDisplay(resultData, true);
            showToast('AI가 봉사와 헌신을 격려하는 새 성경구절을 추천했습니다! ✨', 'ph-sparkle');
        } else {
            throw new Error('성경구절 파싱 실패');
        }
    } catch (err) {
        console.error('fetchBibleVerseAI failed:', err);
        const errMsg = err?.message || 'AI 통신 실패';
        showToast(`AI 연결 안내: ${errMsg}`, 'ph-warning');

        // AI 호출 실패 시 내장 100선 말씀 라이브러리로 즉시 안전하게 전환 (0초 대기)
        currentBibleVerseIndex = (currentBibleVerseIndex + 1) % versesLib.length;
        const fallbackItem = versesLib[currentBibleVerseIndex] || versesLib[0];
        renderCurrentVerseDisplay(fallbackItem, false);
    } finally {
        isFetchingVerseAI = false;
        if (shuffleBtn) shuffleBtn.disabled = false;
    }
}

function openBibleVerseModal() {
    buzz(8);
    updateApiKeyButtons();
    fetchBibleVerseAI(false);
    openSheet('bibleVerseModal');
}

function closeBibleVerseModal() {
    closeSheet('bibleVerseModal');
}

function shuffleBibleVerse() {
    buzz(10);
    fetchBibleVerseAI(true);
}

function copyBibleVerse() {
    buzz(12);
    const versesLib = BIBLE_VERSES; // data.js의 const 전역 (window 속성 아님)
    const item = currentActiveVerse || (versesLib[currentBibleVerseIndex >= 0 ? currentBibleVerseIndex : getTodayVerseIndex()]);
    if (!item) return;
    const textToCopy = `📖 [성광교회 예배부 기도모임 말씀]\n\n"${item.text.replace(/^"|"$/g, '').trim()}"\n— ${item.ref.replace(/^—+|—+$/g, '').trim()} —\n\n🙏 함께 나누는 기도:\n${item.prayer}`;

    let ok = false;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy);
            ok = true;
        }
    } catch (e) { }
    if (!ok && typeof legacyCopy === 'function') ok = legacyCopy(textToCopy);
    showToast('말씀과 기도문이 복사되었습니다! 카톡에 공유해보세요 📋', 'ph-check');
}
