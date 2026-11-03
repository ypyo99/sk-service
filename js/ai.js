// ==========================================
// Gemini AI 실시간 덕담 & 성경구절 추천 모듈
// ==========================================

const GEMINI_API_KEY_STORAGE = 'GEMINI_API_KEY';
const DEFAULT_GEMINI_API_KEY = ''; // 하드코딩 배제: 사용자 직접 입력값만 안전하게 사용

// Gemini 공식 모델 목록 (가장 빠르고 즉시 응답하는 초고속 모델 최우선)
const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite'
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

let currentChoirPresetIndex = 0;

// API 키 가져오기 (오직 localStorage에 사용자가 등록한 값 사용, 공백/따옴표/줄바꿈 완벽 정제)
function getGeminiApiKey() {
    const raw = localStorage.getItem(GEMINI_API_KEY_STORAGE) || DEFAULT_GEMINI_API_KEY || '';
    return raw.replace(/["'\r\n\s]/g, '').trim();
}

// 상단 헤더 버튼의 API 키 등록 상태 배지 갱신
function updateApiKeyButtons() {
    const hasKey = !!getGeminiApiKey();
    const choirBtnText = document.getElementById('choirApiKeyBtnText');
    const verseBtnText = document.getElementById('verseApiKeyBtnText');
    const choirBtn = document.getElementById('choirApiKeyBtn');
    const verseBtn = document.getElementById('verseApiKeyBtn');

    if (choirBtnText) choirBtnText.textContent = hasKey ? 'API 키 (등록됨)' : 'API 키 설정';
    if (verseBtnText) verseBtnText.textContent = hasKey ? 'API 키 (등록됨)' : 'API 키 설정';
    if (choirBtn) choirBtn.classList.toggle('active-key', hasKey);
    if (verseBtn) verseBtn.classList.toggle('active-key', hasKey);
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
function clearGeminiApiKey() {
    if (!confirm('등록된 Gemini API 키를 삭제할까요?\n(삭제 후에는 기본 내장 추천 구절로 동작합니다.)')) return;
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    const input = document.getElementById('geminiApiKeyInput');
    if (input) input.value = '';
    closeGeminiApiKeyModal();
    updateApiKeyButtons();
    showToast('API 키가 삭제되었습니다. (기본 프리셋으로 동작합니다)', 'ph-info');

    syncChoirModalTexts();
}

// 공통 Gemini REST API 호출 함수 (4.5초 초고속 타임아웃 & 토큰 최적화)
async function callGeminiApi(prompt, systemInstruction = '', timeoutMs = 4500) {
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
                    temperature: 0.85,
                    maxOutputTokens: 350
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

                if (res.status === 400 || res.status === 403) {
                    // 키가 잘못되었거나 만료되었거나 비활성화됨
                    const err = new Error('API 키가 올바르지 않거나 권한이 없습니다. (Google AI Studio 키 확인)');
                    err.code = 'INVALID_KEY';
                    err.status = res.status;
                    throw err; // 다른 모델도 동일 키이므로 즉시 탈출
                } else if (res.status === 429) {
                    lastError = new Error('호출 한도(Quota)가 초과되었습니다. 잠시 후 다시 시도해 주세요.');
                    lastError.code = 'QUOTA_EXCEEDED';
                } else {
                    lastError = new Error(`모델 [${model}] 응답 오류 (${res.status})`);
                }
                continue;
            }

            const data = await res.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) {
                lastError = new Error('AI 응답 내용이 비어 있습니다.');
                continue;
            }

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

// 성가대 모달 UI 카드 텍스트 직접 반영 및 반짝임 효과
function updateChoirModalUi(s1, s2) {
    const m1 = document.getElementById('modalQuoteS1');
    const m2 = document.getElementById('modalQuoteS2');
    const cards = document.querySelectorAll('.choir-card');

    if (m1) m1.textContent = `"${s1.replace(/^"|"$/g, '').trim()}"`;
    if (m2) m2.textContent = `"${s2.replace(/^"|"$/g, '').trim()}"`;

    // 갱신 강조 애니메이션
    cards.forEach(card => {
        card.classList.remove('updated-pulse');
        void card.offsetWidth; // 트리거 리플로우
        card.classList.add('updated-pulse');
    });
}

// 프리셋 라이브러리에서 특정 순번의 덕담을 모달에 적용
function applyChoirPresetToUi(index) {
    const item = CHOIR_PRESET_QUOTES[index % CHOIR_PRESET_QUOTES.length];
    if (!item) return;
    updateChoirModalUi(item.service1, item.service2);
}

// 성가대 모달 열기
function openChoirModal() {
    buzz(8);
    updateApiKeyButtons();
    syncChoirModalTexts();
    openSheet('choirQuoteModal');

    // API 키가 있고 아직 오늘 생성된 캐시가 없다면 백그라운드 AI 생성
    const apiKey = getGeminiApiKey();
    if (apiKey) {
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const cacheKey = 'gemini_choir_quote_' + todayKey;
        if (!sessionStorage.getItem(cacheKey) && !localStorage.getItem(cacheKey)) {
            generateChoirQuotesAI(false).then(res => {
                if (res && res.service1 && res.service2) {
                    updateChoirModalUi(res.service1, res.service2);
                }
            }).catch(() => { });
        }
    }
}

function closeChoirQuoteModal() {
    closeSheet('choirQuoteModal');
}

// 성가대 모달 텍스트 동기화 (기본 또는 캐시 로드)
function syncChoirModalTexts() {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cacheKey = 'gemini_choir_quote_' + todayKey;
    let s1 = '';
    let s2 = '';

    try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey));
        if (cached && cached.service1 && cached.service2) {
            s1 = cached.service1;
            s2 = cached.service2;
        }
    } catch (e) { }

    if (s1 && s2) {
        updateChoirModalUi(s1, s2);
    } else {
        applyChoirPresetToUi(currentChoirPresetIndex);
    }
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

// 성가대 덕담 '새 추천 (AI)' 버튼 클릭 핸들러
async function regenerateChoirQuotes() {
    buzz(10);
    const apiKey = getGeminiApiKey();

    const loadingBox = document.getElementById('choirModalLoadingBox');
    const cardsBox = document.getElementById('choirModalCards');
    const regenBtn = document.getElementById('choirModalRegenBtn');

    // 1. API 키가 등록되지 않은 경우: 즉시 다음 추천 프리셋으로 순환하고 안내
    if (!apiKey) {
        currentChoirPresetIndex = (currentChoirPresetIndex + 1) % CHOIR_PRESET_QUOTES.length;
        applyChoirPresetToUi(currentChoirPresetIndex);
        showToast('Gemini API 키를 등록하시면 AI가 실시간으로 새로운 덕담을 만듭니다.', 'ph-key');
        setTimeout(() => {
            openGeminiApiKeyModal();
        }, 400);
        return;
    }

    // 2. API 키가 있는 경우: 로딩 스피너 작동 및 AI 실시간 생성
    if (loadingBox) loadingBox.classList.remove('hidden');
    if (cardsBox) cardsBox.classList.add('hidden');
    if (regenBtn) regenBtn.disabled = true;

    try {
        const result = await generateChoirQuotesAI(true);
        if (result && result.service1 && result.service2) {
            updateChoirModalUi(result.service1, result.service2);
            showToast('새로운 AI 맞춤 덕담이 생성되었습니다! ✨', 'ph-sparkle');
        } else {
            throw new Error('AI 응답 데이터 형식 불일치');
        }
    } catch (err) {
        console.error('regenerateChoirQuotes failed:', err);
        const errMsg = err?.message || 'AI 통신 실패';
        showToast(`AI 생성 실패: ${errMsg}`, 'ph-warning');

        // AI 실패 시에도 텍스트가 멈춰있지 않도록 다음 추천 프리셋으로 확실히 전환
        currentChoirPresetIndex = (currentChoirPresetIndex + 1) % CHOIR_PRESET_QUOTES.length;
        applyChoirPresetToUi(currentChoirPresetIndex);
    } finally {
        if (loadingBox) loadingBox.classList.add('hidden');
        if (cardsBox) cardsBox.classList.remove('hidden');
        if (regenBtn) regenBtn.disabled = false;
    }
}

// Gemini AI를 통한 실시간 맞춤 성가대 덕담 생성
async function generateChoirQuotesAI(forceRefresh = false) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return null;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cacheKey = 'gemini_choir_quote_' + todayKey;

    // 이미 오늘 생성된 덕담이 있고 강제 새로고침이 아닌 경우 캐시 반환
    if (!forceRefresh) {
        try {
            const cached = JSON.parse(sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey));
            if (cached && cached.service1 && cached.service2) {
                return cached;
            }
        } catch (e) { }
    }

    // 매번 다른 각도와 주제로 신선한 덕담을 유도하는 무작위 힌트 풀
    const ANGLES_1 = [
        "이른 아침 피로를 잊게 하는 환한 미소와 정성 어린 찬양",
        "새벽 첫 시간을 아름다운 화음으로 깨워준 고마움",
        "주일 아침 가장 먼저 예배당을 거룩한 찬양으로 채워준 수고",
        "지휘자, 반주자, 대원들이 하나 된 따뜻한 하모니에 대한 감사",
        "아침 일찍 준비된 찬양이 성도들의 마음에 큰 힘이 되었다는 칭찬"
    ];

    const ANGLES_2 = [
        "온 성도의 마음에 큰 감동과 평안을 선물해 준 찬양의 은혜",
        "한 주간 열심히 기도하고 준비한 정성이 가슴에 와닿았다는 감사",
        "풍성하고 웅장한 화음으로 예배를 더욱 거룩하게 빛내준 수고",
        "성도들에게 한 주간을 살아갈 큰 용기와 소망을 안겨준 은혜로운 찬양",
        "마음을 다해 부른 찬양으로 하나님께 영광 돌린 대원들에 대한 칭찬"
    ];

    const angle1 = ANGLES_1[Math.floor(Math.random() * ANGLES_1.length)];
    const angle2 = ANGLES_2[Math.floor(Math.random() * ANGLES_2.length)];
    const randomNonce = Math.floor(Math.random() * 10000);
    const month = now.getMonth() + 1;

    const prompt = `오늘 날짜는 ${now.getFullYear()}년 ${month}월입니다. 교회 예배부 사역자가 주일 예배 성가대원들에게 건넬 아주 쉽고 따뜻한 1줄 덕담(격려 문구)을 작성해 주세요. (고유번호: ${randomNonce})

[격려 초점]
- 1부 성가대: ${angle1}
- 2부 성가대: ${angle2}

[작성 지침 - 절대 준수]
1. 어려운 한자어나 거창한 문어체(예: '풍성케 하심', '화답하여', '심령', '헌신' 등)는 절대 쓰지 마세요.
2. 초등학생도 편하게 알아들을 수 있을 만큼 쉽고 다정한 일상 단어만 쓰세요.
3. 어미는 정중하고 부드러운 존댓말(~감사해요, ~고맙습니다, ~힘이 돼요 등)로 작성하세요.
4. 각 문장은 20~28자 내외로 아주 짧고 산뜻하게 작성하세요. (따옴표 제외)

반드시 아래 JSON 형식으로만 응답해 주세요:
{
  "theme": "${month}월 찬양 감사",
  "service1": "1부 덕담 문구",
  "service2": "2부 덕담 문구"
}`;

    const rawText = await callGeminiApi(prompt);
    const resultData = parseJsonFromText(rawText);

    if (resultData && resultData.service1 && resultData.service2) {
        try {
            localStorage.setItem(cacheKey, JSON.stringify(resultData));
            sessionStorage.setItem(cacheKey, JSON.stringify(resultData));
        } catch (e) { }
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
    return Math.abs(seed) % (window.BIBLE_VERSES ? window.BIBLE_VERSES.length : 100);
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
    const versesLib = window.BIBLE_VERSES || [];
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

    const VERSE_ANGLES = [
        "주일 아침 일찍 나와 보이지 않는 곳에서 묵묵히 헌신하는 예배위원의 봉사를 크게 칭찬하고 기억하시는 하나님의 은혜",
        "지치지 않고 기쁨으로 섬길 때 하나님께서 풍성한 상급과 평안을 예비해 두셨다는 격려와 축복",
        "성도들을 온 마음과 미소로 맞이하며 예배를 돕는 섬김의 손길에 부어주시는 하늘의 복",
        "하나님의 집에서 한 날 문지기로 섬김이 세상의 천 날보다 낫다는 감사와 거룩한 자부심",
        "사랑과 봉사로 하나 되어 주님의 몸 된 교회를 든든히 세워가는 거룩한 동역자들의 수고 칭찬"
    ];
    const pickedAngle = VERSE_ANGLES[Math.floor(Math.random() * VERSE_ANGLES.length)];
    const randomNonce = Math.floor(Math.random() * 10000);

    // 프롬프트 압축 (토큰 처리 속도 및 생성 시간 극대화)
    const prompt = `교회 주일 아침 8시 30분 예배위원(안내/봉사/기도/방송실)들의 '봉사, 헌신, 수고'를 크게 칭찬하고 격려하는 성경구절 1개와 짧은 축복 기도문을 작성하세요. (코드:${randomNonce})
초점: ${pickedAngle}

[규칙]
1. text: 실제 개역개정 성경 본문 그대로 (봉사와 수고 칭찬 격려)
2. ref: 정확한 책 이름과 장절
3. tags: 핵심 태그 2개 배열
4. prayer: 예배위원을 축복하는 1줄 기도문 (~하옵소서)

반드시 아래 JSON 형식으로만 응답:
{
  "ref": "성경 출처",
  "text": "실제 본문",
  "tags": ["수고 칭찬", "은혜"],
  "prayer": "축복 기도문"
}`;

    try {
        const rawText = await callGeminiApi(prompt);
        const resultData = parseJsonFromText(rawText);

        if (resultData && resultData.text && resultData.ref) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify(resultData));
                sessionStorage.setItem(cacheKey, JSON.stringify(resultData));
            } catch (e) { }

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
    const versesLib = window.BIBLE_VERSES || [];
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
