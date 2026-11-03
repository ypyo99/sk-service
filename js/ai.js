// ==========================================
// Gemini AI 실시간 덕담 & 성경구절 추천 모듈
// ==========================================

// === 매월 첫번째 일요일 알림 & Gemini AI 실시간 덕담 생성 ===
        const GEMINI_API_KEY_STORAGE = 'GEMINI_API_KEY';
        const DEFAULT_GEMINI_API_KEY = ''; // 필요 시 기본 키를 설정 가능

        function getGeminiApiKey() {
            return (DEFAULT_GEMINI_API_KEY || localStorage.getItem(GEMINI_API_KEY_STORAGE) || '').trim();
        }

        function openGeminiApiKeyModal() {
            const input = document.getElementById('geminiApiKeyInput');
            if (input) input.value = getGeminiApiKey();
            openSheet('geminiKeyModal');
        }

        function closeGeminiApiKeyModal() {
            closeSheet('geminiKeyModal');
        }

        function saveGeminiApiKey() {
            const val = (document.getElementById('geminiApiKeyInput').value || '').trim();
            if (!val) {
                showToast('API 키를 입력해 주세요.', 'ph-warning');
                return;
            }
            localStorage.setItem(GEMINI_API_KEY_STORAGE, val);
            closeGeminiApiKeyModal();
            showToast('Gemini API 키가 저장되었습니다!', 'ph-check-circle');
            generateChoirQuotesAI(true);
        }

        function openChoirModal() {
            buzz(8);
            syncChoirModalTexts();
            openSheet('choirQuoteModal');
            // 만약 API 키가 있고 아직 오늘 생성된 게 없다면 자동 생성 시도
            const apiKey = getGeminiApiKey();
            if (apiKey) {
                const now = new Date();
                const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const cacheKey = 'gemini_choir_quote_' + todayKey;
                if (!sessionStorage.getItem(cacheKey) && !localStorage.getItem(cacheKey)) {
                    generateChoirQuotesAI(false);
                }
            }
        }

        function closeChoirQuoteModal() {
            closeSheet('choirQuoteModal');
        }

        function syncChoirModalTexts() {
            const now = new Date();
            const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const cacheKey = 'gemini_choir_quote_' + todayKey;
            try {
                const cached = JSON.parse(sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey));
                if (cached && cached.service1 && cached.service2) {
                    const m1 = document.getElementById('modalQuoteS1');
                    const m2 = document.getElementById('modalQuoteS2');
                    if (m1) m1.textContent = `"${cached.service1.replace(/^"|"$/g, '').trim()}"`;
                    if (m2) m2.textContent = `"${cached.service2.replace(/^"|"$/g, '').trim()}"`;
                }
            } catch (e) { }
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

        async function regenerateChoirQuotes() {
            buzz(10);
            const loadingBox = document.getElementById('choirModalLoadingBox');
            const cardsBox = document.getElementById('choirModalCards');
            const regenBtn = document.getElementById('choirModalRegenBtn');
            if (loadingBox) loadingBox.classList.remove('hidden');
            if (cardsBox) cardsBox.classList.add('hidden');
            if (regenBtn) regenBtn.disabled = true;

            await generateChoirQuotesAI(true);
            syncChoirModalTexts();

            if (loadingBox) loadingBox.classList.add('hidden');
            if (cardsBox) cardsBox.classList.remove('hidden');
            if (regenBtn) regenBtn.disabled = false;
        }

        // Gemini AI를 통한 실시간 맞춤 덕담 생성
        async function generateChoirQuotesAI(forceRefresh = false) {
            const apiKey = getGeminiApiKey();
            const loadingBox = document.getElementById('quoteLoadingBox');
            const noKeyBox = document.getElementById('quoteNoKeyBox');
            const quotesContainer = document.getElementById('quoteQuotesContainer');
            const themeEl = document.getElementById('quoteThemeText');
            const s1El = document.getElementById('quoteTextService1');
            const s2El = document.getElementById('quoteTextService2');
            const regenBtn = document.getElementById('quoteRegenBtn');

            if (!apiKey) {
                if (loadingBox) loadingBox.classList.add('hidden');
                if (quotesContainer) quotesContainer.classList.add('hidden');
                if (noKeyBox) noKeyBox.classList.remove('hidden');
                if (themeEl) themeEl.innerHTML = '<i class="ph-bold ph-sparkle"></i> AI 덕담 생성 대기';
                return;
            }

            if (noKeyBox) noKeyBox.classList.add('hidden');

            const now = new Date();
            const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const cacheKey = 'gemini_choir_quote_' + todayKey;

            // 이미 오늘 생성된 덕담이 있고 강제 새로고침이 아닌 경우 캐시 표시
            if (!forceRefresh) {
                try {
                    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey));
                    if (cached && cached.service1 && cached.service2) {
                        if (themeEl) themeEl.innerHTML = `<i class="ph-bold ph-sparkle"></i> ${cached.theme || (now.getMonth() + 1) + '월 AI 추천 덕담'}`;
                        if (s1El) s1El.textContent = `"${cached.service1}"`;
                        if (s2El) s2El.textContent = `"${cached.service2}"`;
                        if (quotesContainer) quotesContainer.classList.remove('hidden');
                        if (loadingBox) loadingBox.classList.add('hidden');
                        return;
                    }
                } catch (e) { }
            }

            // 로딩 상태 시작
            if (loadingBox) loadingBox.classList.remove('hidden');
            if (quotesContainer) quotesContainer.classList.add('hidden');
            if (regenBtn) regenBtn.disabled = true;

            const month = now.getMonth() + 1;
            const prompt = `오늘 날짜는 ${now.getFullYear()}년 ${month}월입니다. 교회 예배부 사역자가 매월 첫 주일 성가대원들에게 건넬 아주 쉽고 따뜻한 1줄 덕담(격려 문구)을 작성해 주세요.

[작성 지침 - 매우 중요]
1. 어려운 한자어나 거창한 문어체(예: '풍성케 하심', '화답하여', '심령', '헌신' 등)는 절대 쓰지 마세요.
2. 초등학생도 편하게 알아들을 수 있을 만큼 쉽고 다정한 일상 단어만 쓰세요.
3. 어미는 정중하고 부드러운 존댓말(~감사합니다, ~고맙습니다, ~힘이 돼요 등)로 작성하세요.
4. 25자 내외로 아주 짧고 산뜻하게 작성하세요.
- 1부 성가대: 아침 일찍 나와서 찬양해 주신 분들께 쉬운 말로 고마운 마음 전하기 (예: "아침 일찍 정성껏 찬양해 주셔서 정말 감사해요!")
- 2부 성가대: 오늘 찬양이 참 듣기 좋고 마음에 와닿았다는 칭찬과 고마움 전하기 (예: "오늘 찬양이 참 좋아서 마음에 큰 힘이 돼요!")

반드시 아래 JSON 형식으로만 응답해 주세요:
{
  "theme": "${month}월 테마 (쉬운 말로, 예: 고마운 마음 가득한 ${month}월)",
  "service1": "1부 덕담 문구",
  "service2": "2부 덕담 문구"
}`;

            const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
            let resultData = null;

            for (const model of models) {
                try {
                    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                responseMimeType: 'application/json',
                                temperature: 0.8
                            }
                        })
                    });

                    if (!res.ok) continue;
                    const data = await res.json();
                    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (rawText) {
                        resultData = JSON.parse(rawText.replace(/```json|```/g, '').trim());
                        if (resultData && resultData.service1 && resultData.service2) {
                            break;
                        }
                    }
                } catch (err) {
                    console.warn(`Model ${model} failed, trying next:`, err);
                }
            }

            if (loadingBox) loadingBox.classList.add('hidden');
            if (regenBtn) regenBtn.disabled = false;

            if (resultData && resultData.service1 && resultData.service2) {
                if (themeEl) themeEl.innerHTML = `<i class="ph-bold ph-sparkle"></i> ${resultData.theme || month + '월 AI 추천 덕담'}`;
                if (s1El) s1El.textContent = `"${resultData.service1.replace(/^"|"$/g, '').trim()}"`;
                if (s2El) s2El.textContent = `"${resultData.service2.replace(/^"|"$/g, '').trim()}"`;
                const mq1 = document.getElementById('modalQuoteS1');
                const mq2 = document.getElementById('modalQuoteS2');
                if (mq1) mq1.textContent = `"${resultData.service1.replace(/^"|"$/g, '').trim()}"`;
                if (mq2) mq2.textContent = `"${resultData.service2.replace(/^"|"$/g, '').trim()}"`;
                if (quotesContainer) quotesContainer.classList.remove('hidden');

                try {
                    localStorage.setItem(cacheKey, JSON.stringify(resultData));
                    sessionStorage.setItem(cacheKey, JSON.stringify(resultData));
                } catch (e) { }

                if (forceRefresh) {
                    showToast('새로운 AI 맞춤 덕담이 생성되었습니다! ✨', 'ph-sparkle');
                }
            } else {
                showToast('AI 덕담 생성에 실패했습니다. API 키를 확인해 주세요.', 'ph-warning-circle');
                if (quotesContainer) quotesContainer.classList.remove('hidden');
            }
        }

        function copyQuote(elemId) {
            const el = document.getElementById(elemId);
            if (!el) return;
            const text = el.textContent.replace(/^"|"$/g, '').trim();
            let ok = false;
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(text);
                    ok = true;
                }
            } catch (e) { }
            if (!ok && typeof legacyCopy === 'function') ok = legacyCopy(text);
            showToast('덕담 문구가 복사되었습니다.', 'ph-copy');
        }

        // ==========================================
        // 예배위원 8:30 기도모임 성경구절 (용기, 평안, 기쁨, 섬김)
        // ==========================================

function getTodayVerseIndex() {
            const now = new Date();
            const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
            return Math.abs(seed) % BIBLE_VERSES.length;
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
                tagsEl.innerHTML = item.tags.map(t => `<span class="vtag"><i class="ph-bold ph-heart"></i>${t}</span>`).join('');
            }
            if (badgeEl) {
                badgeEl.innerHTML = isAI
                    ? '<i class="ph-bold ph-sparkle"></i> AI 추천 · 예배위원 헌신·수고 격려'
                    : '<i class="ph-bold ph-book-open-text"></i> 예배위원 기도모임 말씀';
            }
        }

        // Gemini API를 통해 예배위원들의 봉사, 헌신, 수고를 칭찬하는 맞춤 성경구절 생성
        async function fetchBibleVerseAI(forceRefresh = false) {
            const apiKey = getGeminiApiKey();
            const shuffleBtn = document.getElementById('modalVerseShuffleBtn');
            const textEl = document.getElementById('modalVerseText');
            const refEl = document.getElementById('modalVerseRef');
            const tagsEl = document.getElementById('modalVerseTags');
            const prayerEl = document.getElementById('modalVersePrayer');

            // API 키가 없으면 내장 말씀 라이브러리 사용
            if (!apiKey) {
                if (currentBibleVerseIndex < 0) currentBibleVerseIndex = getTodayVerseIndex();
                else if (forceRefresh) {
                    let nextIdx;
                    do {
                        nextIdx = Math.floor(Math.random() * BIBLE_VERSES.length);
                    } while (nextIdx === currentBibleVerseIndex && BIBLE_VERSES.length > 1);
                    currentBibleVerseIndex = nextIdx;
                }
                const fallbackItem = BIBLE_VERSES[currentBibleVerseIndex];
                renderCurrentVerseDisplay(fallbackItem, false);
                return;
            }

            const now = new Date();
            const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const cacheKey = 'gemini_verse_quote_' + todayKey;

            // 이미 오늘 생성된 캐시가 있고 강제 새로고침이 아닌 경우 즉시 표시
            if (!forceRefresh) {
                try {
                    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey));
                    if (cached && cached.text && cached.ref && cached.prayer) {
                        renderCurrentVerseDisplay(cached, true);
                        return;
                    }
                } catch (e) { }
            }

            // 로딩 상태 시작
            isFetchingVerseAI = true;
            if (shuffleBtn) shuffleBtn.disabled = true;
            if (textEl) {
                textEl.innerHTML = '<span style="display:inline-flex; align-items:center; gap:8px; color:#b45309; font-size:15px;"><i class="ph-bold ph-spinner-gap spin" style="font-size:20px;"></i> AI가 예배위원들의 수고와 헌신을 격려하는 성경구절을 찾는 중입니다...</span>';
            }
            if (refEl) refEl.textContent = '';
            if (tagsEl) tagsEl.innerHTML = '';
            if (prayerEl) prayerEl.innerHTML = '<span style="color:var(--muted); font-size:13px;">말씀과 함께 나눌 칭찬과 축복 기도문을 준비하고 있습니다...</span>';

            const prompt = `교회 예배위원(안내위원, 봉사위원, 헌금/기도위원, 방송실, 성가대 등)들이 매주일 아침 8시 30분에 모여 간단히 기도하고 봉사를 시작합니다.
주일 아침 일찍 나와 보이지 않는 곳에서 정성을 다해 섬기는 예배위원들의 '봉사, 헌신, 수고'를 크게 칭찬하고, 하나님께서 그 수고를 기억하시며 큰 상급과 평안, 기쁨을 주신다는 격려의 성경구절 1개를 추천해 주세요.

[작성 지침 - 매우 중요]
1. 성경구절(text): 반드시 실제 개역개정 성경 본문 그대로 정확하게 작성해 주세요. (예: 고린도전서 15장 58절, 히브리서 6장 10절, 마태복음 25장 21절, 골로새서 3장 23~24절, 베드로전서 4장 10절, 갈라디아서 6장 9절, 시편 84편 10절, 데살로니가전서 1장 3절 등 성도의 봉사와 수고를 칭찬하고 격려하는 말씀)
2. 성경 출처(ref): 정확한 책 이름과 장, 절 (예: "히브리서 6장 10절", "고린도전서 15장 58절")
3. 주제 태그(tags): 2~3개의 짧은 핵심 키워드 (예: ["수고 칭찬", "하나님의 기억", "기쁨의 헌신"])
4. 함께 나누는 기도(prayer): 주일 아침 일찍 나와 묵묵히 헌신하는 예배위원들의 수고를 하나님께서 기뻐 받으시길 바라며, 그들의 마음에 하늘의 기쁨과 위로가 넘쳐나기를 간구하는 따뜻한 1~2줄의 칭찬·축복 기도문 (~하옵소서)

반드시 아래 JSON 형식으로만 응답해 주세요:
{
  "ref": "성경 장절 (예: 히브리서 6장 10절)",
  "text": "실제 성경 구절 본문",
  "tags": ["수고 칭찬", "섬김의 보상", "은혜"],
  "prayer": "예배위원들의 봉사와 헌신을 칭찬하고 축복하는 기도문 (1~2줄)"
}`;

            const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
            let resultData = null;

            for (const model of models) {
                try {
                    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                responseMimeType: 'application/json',
                                temperature: 0.85
                            }
                        })
                    });

                    if (!res.ok) continue;
                    const data = await res.json();
                    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (rawText) {
                        resultData = JSON.parse(rawText.replace(/```json|```/g, '').trim());
                        if (resultData && resultData.text && resultData.ref && resultData.prayer) {
                            break;
                        }
                    }
                } catch (err) {
                    console.warn(`Verse generation with ${model} failed:`, err);
                }
            }

            isFetchingVerseAI = false;
            if (shuffleBtn) shuffleBtn.disabled = false;

            if (resultData && resultData.text && resultData.ref) {
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(resultData));
                    sessionStorage.setItem(cacheKey, JSON.stringify(resultData));
                } catch (e) { }

                renderCurrentVerseDisplay(resultData, true);
                if (forceRefresh) {
                    showToast('AI가 봉사와 헌신을 격려하는 새 성경구절을 추천했습니다! ✨', 'ph-sparkle');
                }
            } else {
                // AI 호출 실패 시 내장 말씀 라이브러리로 안전하게 fallback
                if (currentBibleVerseIndex < 0) currentBibleVerseIndex = getTodayVerseIndex();
                else if (forceRefresh) {
                    currentBibleVerseIndex = (currentBibleVerseIndex + 1) % BIBLE_VERSES.length;
                }
                const fallbackItem = BIBLE_VERSES[currentBibleVerseIndex];
                renderCurrentVerseDisplay(fallbackItem, false);
                if (forceRefresh) {
                    showToast('새로운 성경구절과 기도문으로 변경되었습니다! ✨', 'ph-sparkle');
                }
            }
        }

        function openBibleVerseModal() {
            buzz(8);
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
            const item = currentActiveVerse || (BIBLE_VERSES[currentBibleVerseIndex >= 0 ? currentBibleVerseIndex : getTodayVerseIndex()]);
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

