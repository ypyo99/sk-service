// ==========================================
// 성광교회 예배부 체크리스트 - 메인 앱 로직
// ==========================================

function esc(s) {
            return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function parseCSV(text) {
            const rows = [];
            let row = [], field = '', inQuotes = false;
            for (let i = 0; i < text.length; i++) {
                const c = text[i];
                if (inQuotes) {
                    if (c === '"') {
                        if (text[i + 1] === '"') { field += '"'; i++; }
                        else inQuotes = false;
                    } else field += c;
                } else if (c === '"') inQuotes = true;
                else if (c === ',') { row.push(field); field = ''; }
                else if (c === '\n' || c === '\r') {
                    if (c === '\r' && text[i + 1] === '\n') i++;
                    row.push(field); rows.push(row); row = []; field = '';
                } else field += c;
            }
            if (field !== '' || row.length) { row.push(field); rows.push(row); }
            return rows;
        }

        function hashId(str) {
            let h = 5381;
            for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
            return 't_' + (h >>> 0).toString(36);
        }

        function compareCode(a, b) {
            const na = parseFloat(a), nb = parseFloat(b);
            const ia = isNaN(na), ib = isNaN(nb);
            if (!ia && !ib) return na - nb;
            if (ia && ib) return a.localeCompare(b);
            return ia ? 1 : -1; // 숫자 코드가 먼저, 문자(X 등)는 뒤
        }

        function buildDataFromRows(rows) {
            rows = rows.map(r => r.map(c => (c || '').trim())).filter(r => r.some(c => c));
            if (!rows.length) throw new Error('시트가 비어 있습니다.');

            // 헤더 인식
            let col = { cat: 0, code: 1, text: 2, badge: -1, urgent: -1 };
            const header = rows[0];
            const findCol = (...keys) => header.findIndex(h => keys.some(k => h.includes(k)));
            const hasHeader = findCol('작업구분', '순서코드', '작업내용') !== -1;
            if (hasHeader) {
                const c = findCol('작업구분'), o = findCol('순서코드', '코드'), t = findCol('작업내용', '내용');
                if (c !== -1) col.cat = c;
                if (o !== -1) col.code = o;
                if (t !== -1) col.text = t;
                col.badge = findCol('배지', '비고');
                col.urgent = findCol('긴급', '알림');
                rows = rows.slice(1);
            }

            const items = [];
            const catMap = new Map();
            const idCount = {};
            rows.forEach(r => {
                const code = (r[col.code] || '').replace(/\.$/, '');
                const text = r[col.text] || '';
                if (!code || !text) return;
                let catName = (r[col.cat] || '').replace(new RegExp('^' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.?\\s*'), '') || '기타';

                if (!catMap.has(code)) catMap.set(code, catName);
                catName = catMap.get(code);

                let id = hashId(code + '|' + text);
                idCount[id] = (idCount[id] || 0) + 1;
                if (idCount[id] > 1) id += '_' + idCount[id];

                const item = { id, code, category: catName, text };
                if (col.badge !== -1 && r[col.badge]) item.badge = r[col.badge];
                if (col.urgent !== -1 && r[col.urgent]) item.urgent = r[col.urgent];
                if (text.includes('출석체크')) item.actionType = 'attendanceModal';
                else if (text.includes('사회자 없을 때')) item.actionType = 'offeringManual';
                items.push(item);
            });

            if (!items.length) throw new Error('유효한 항목이 없습니다.');

            const cats = [...catMap.entries()]
                .sort((a, b) => compareCode(a[0], b[0]))
                .map(([code, name]) => ({ code, name, label: `${code}. ${name}` }));
            const order = cats.map(c => c.code);
            items.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
            return { categories: cats, items };
        }

        function applyData(data) {
            let fb = 0;
            // 색상은 캐시와 무관하게 항상 현재 설정으로 다시 지정
            CATEGORIES = data.categories.map(c => ({
                code: c.code, name: c.name, label: c.label,
                color: CATEGORY_COLORS[c.code] || FALLBACK_COLORS[fb++ % FALLBACK_COLORS.length]
            }));
            SPREADSHEET_ITEMS = data.items;
            if (appState.selectedCategory !== 'ALL' && !CATEGORIES.some(c => c.code === appState.selectedCategory)) {
                appState.selectedCategory = 'ALL';
            }
        }

        function showLoading(msg) {
            document.getElementById('checklistContainer').innerHTML = `
                <div class="empty">
                    <div class="big-icon load"><i class="ph-bold ph-spinner-gap spin"></i></div>
                    <h3>${msg}</h3>
                </div>`;
        }

        // 성공하면 true, 실패하면 false. quiet이면 실패 알림을 호출한 쪽에 맡김
        async function loadSheetData(quiet) {
            // 캐시가 있으면 먼저 표시 (오프라인 대비)
            let cached = null;
            try { cached = JSON.parse(localStorage.getItem(DATA_CACHE_KEY) || 'null'); } catch (e) { }
            if (cached && cached.items && cached.items.length) {
                applyData(cached);
                renderAll();
            } else {
                showLoading('체크리스트를 불러오는 중...');
            }

            try {
                const res = await fetch(SHEET_CSV_URL + '&_=' + Date.now(), { cache: 'no-store' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const text = await res.text();
                if (text.trim().startsWith('<')) throw new Error('시트 공유 권한을 확인하세요 (링크가 있는 모든 사용자 - 뷰어).');
                const data = buildDataFromRows(parseCSV(text));
                applyData(data);
                try { localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data)); } catch (e) { }
                renderAll();
                return true;
            } catch (e) {
                console.error('Sheet load error:', e);
                if (cached && cached.items && cached.items.length) {
                    if (!quiet) showToast('시트 연결 실패 – 저장된 데이터로 표시합니다.', 'ph-wifi-slash');
                } else {
                    document.getElementById('checklistContainer').innerHTML = `
                        <div class="empty">
                            <div class="big-icon err"><i class="ph-bold ph-warning-circle"></i></div>
                            <h3>데이터를 불러오지 못했습니다</h3>
                            <p>${esc(e.message)}</p>
                            <button class="pill-btn" onclick="loadSheetData()"><i class="ph-bold ph-arrow-clockwise"></i>다시 시도</button>
                        </div>`;
                }
                return false;
            }
        }

        const STORAGE_KEY = 'CHURCH_WORSHIP_SHEET_V2';
        let appState = {
            currentService: 'service1', // 'service1' | 'service2' | 'afternoon' | 'dawn'
            selectedCategory: 'ALL',    // 'ALL' 또는 순서코드
            filterUnchecked: false,
            searchQuery: '',
            collapsedGroups: {},        // 'ALL' 보기에서 접힌 그룹
            checkedByService: {
                service1: {},
                service2: {},
                afternoon: {},
                dawn: {}
            },
            currentAttTab: 'att1',
            attendance: {
                att1: { male: 0, female: 0, broadcast: 0 },
                att2: { male: 0, female: 0, broadcast: 0 },
                att3: { male: 0, female: 0, broadcast: 0 },
                attDawn: { male: 0, female: 0, broadcast: 0 }
            }
        };

        function loadState() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    appState = {
                        ...appState,
                        ...parsed,
                        searchQuery: '',
                        checkedByService: { ...appState.checkedByService, ...(parsed.checkedByService || {}) },
                        attendance: { ...appState.attendance, ...(parsed.attendance || {}) },
                        collapsedGroups: { ...(parsed.collapsedGroups || {}) }
                    };
                }
            } catch (e) {
                console.error('State load error:', e);
            }
        }

        function saveState() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
            } catch (e) {
                console.error('State save error:', e);
            }
        }

        function buzz(ms) {
            try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) { }
        }

        function updateDateDisplay() {
            const now = new Date();
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            document.getElementById('currentDateText').textContent =
                `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
        }

        function selectService(srvKey) {
            appState.currentService = srvKey;
            if (srvKey === 'service1') appState.currentAttTab = 'att1';
            if (srvKey === 'service2') appState.currentAttTab = 'att2';
            if (srvKey === 'afternoon') appState.currentAttTab = 'att3';
            if (srvKey === 'dawn') appState.currentAttTab = 'attDawn';
            wasComplete = isServiceComplete();
            saveState();
            renderAll();
        }

        function selectCategory(code) {
            appState.selectedCategory = code;
            saveState();
            renderAll();
            setTimeout(() => {
                if (code === 'ALL') {
                    // 전체 선택 시 항목버튼(chipbar) 위로 스크롤하여 사라지게 함
                    const mainEl = document.querySelector('main');
                    if (mainEl) {
                        const topPos = mainEl.getBoundingClientRect().top + window.pageYOffset;
                        window.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });
                    }
                } else {
                    const sec = document.getElementById(`cat-section-${code}`);
                    if (sec) {
                        const chipbar = document.querySelector('.chipbar');
                        const isSticky = chipbar && !chipbar.classList.contains('not-sticky');
                        const offset = (isSticky ? chipbar.offsetHeight : 0) + 12;
                        const topPos = sec.getBoundingClientRect().top + window.pageYOffset - offset;
                        window.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });
                    }
                }
            }, 60);
        }

        function toggleFilterUnchecked() {
            appState.filterUnchecked = !appState.filterUnchecked;
            saveState();
            renderAll();
        }

        function handleSearch(val) {
            appState.searchQuery = val.trim();
            document.getElementById('clearSearchBtn').classList.toggle('hidden', !appState.searchQuery);
            renderChecklist();
        }

        function clearSearch() {
            appState.searchQuery = '';
            document.getElementById('searchInput').value = '';
            document.getElementById('clearSearchBtn').classList.add('hidden');
            renderChecklist();
        }

        function isServiceComplete() {
            const checkedMap = appState.checkedByService[appState.currentService] || {};
            return SPREADSHEET_ITEMS.length > 0 && SPREADSHEET_ITEMS.every(i => checkedMap[i.id]);
        }

        function afterCheckChange() {
            saveState();
            renderAll();
            const done = isServiceComplete();
            const justCompleted = done && !wasComplete;
            if (justCompleted) {
                buzz([30, 60, 30]);
                showToast(`${SERVICE_NAMES[appState.currentService]} 모든 항목 완료! 수고하셨습니다 🙏`, 'ph-confetti');
            }
            wasComplete = done;
            return justCompleted;
        }

        function toggleItemCheck(itemId) {
            const srv = appState.currentService;
            if (!appState.checkedByService[srv]) appState.checkedByService[srv] = {};
            const next = !appState.checkedByService[srv][itemId];
            appState.checkedByService[srv][itemId] = next;
            lastToggledId = next ? itemId : null;
            buzz(10);
            afterCheckChange();
            lastToggledId = null;
        }

        // 키보드: 항목에 포커스가 있을 때 Space/Enter로 체크 (다시 그린 뒤에도 포커스 유지)
        function itemKeydown(e, itemId) {
            if (e.target !== e.currentTarget) return; // 안쪽 버튼(사진 등)의 키 입력은 그대로 둠
            if (e.key !== ' ' && e.key !== 'Enter') return;
            e.preventDefault();
            toggleItemCheck(itemId);
            const el = document.getElementById(`item-${itemId}`);
            if (el) el.focus();
        }

        function toggleCategoryGroupAll(code) {
            const srv = appState.currentService;
            if (!appState.checkedByService[srv]) appState.checkedByService[srv] = {};
            const groupItems = SPREADSHEET_ITEMS.filter(i => i.code === code);
            const allChecked = groupItems.every(i => !!appState.checkedByService[srv][i.id]);
            const snap = snapshotRecords();
            groupItems.forEach(i => {
                appState.checkedByService[srv][i.id] = !allChecked;
            });
            const catObj = CATEGORIES.find(c => c.code === code);
            buzz(15);
            const justCompleted = afterCheckChange();
            const msg = justCompleted
                ? `${SERVICE_NAMES[srv]} 모든 항목 완료! 수고하셨습니다 🙏`
                : (!allChecked ? `${catObj.label} 전체 완료` : `${catObj.label} 전체 해제`);
            showUndoToast(msg, justCompleted ? 'ph-confetti' : (!allChecked ? 'ph-check-circle' : 'ph-arrow-counter-clockwise'), snap);
        }

        function toggleGroupCollapse(code) {
            appState.collapsedGroups[code] = !appState.collapsedGroups[code];
            saveState();
            renderChecklist();
        }

        let lastCenteredCategory = null;
        function renderHeaderAndTabs() {
            // 1. 예배 선택
            ['service1', 'service2', 'afternoon', 'dawn'].forEach(s => {
                const btn = document.getElementById(`srv-${s}`);
                if (btn) btn.classList.toggle('active', appState.currentService === s);
            });

            // 2. 진행률
            const checkedMap = appState.checkedByService[appState.currentService] || {};
            const totalCount = SPREADSHEET_ITEMS.length;
            const doneCount = SPREADSHEET_ITEMS.filter(i => checkedMap[i.id]).length;
            const remaining = totalCount - doneCount;
            const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

            document.getElementById('progressLabel').textContent = SERVICE_NAMES[appState.currentService];
            document.getElementById('progressSub').innerHTML = !totalCount
                ? '불러오는 중...'
                : remaining === 0
                    ? `${totalCount}개 모두 완료했어요 ✨`
                    : `${doneCount} / ${totalCount} 완료 · <b>${remaining}개 남음</b>`;
            document.getElementById('progressPercent').textContent = `${pct}%`;
            document.getElementById('progressBar').style.width = `${pct}%`;
            const C = 2 * Math.PI * 27;
            document.getElementById('progressRing').style.strokeDashoffset = C * (1 - pct / 100);
            document.getElementById('progressRingWrap').classList.toggle('complete', totalCount > 0 && remaining === 0);

            // 2-1. 스크롤 시 보이는 축소 진행률 바
            document.getElementById('miniSrv').textContent = SERVICE_NAMES[appState.currentService];
            document.getElementById('miniCnt').textContent = totalCount ? (remaining === 0 ? '모두 완료' : `${remaining}개 남음`) : '';
            document.getElementById('miniPct').textContent = `${pct}%`;
            document.getElementById('miniProgress').style.width = `${pct}%`;
            document.getElementById('moreResetLabel').textContent = `${SERVICE_NAMES[appState.currentService]} 초기화`;

            // 3. 남은 것만 스위치
            document.getElementById('filterBtn').classList.toggle('on', appState.filterUnchecked);

            // 4. 카테고리별 진행 타일
            const tileHtml = (key, codeHtml, name, color, done, total) => {
                const rem = total - done;
                const pct = total ? (done / total) * 100 : 0;
                return `
                    <button class="tile ${rem === 0 ? 'done' : 'has-unchecked'} ${appState.selectedCategory === key ? 'active' : ''}" style="--c:${color}" onclick="selectCategory('${esc(key)}')" title="${esc(name)} ${done}/${total}">
                        <div class="tile-top">
                            <span class="tile-code">${codeHtml}</span>
                            <span class="tile-cnt">${rem === 0 ? '<i class="ph-bold ph-check"></i>' : `<b>${done}</b>/${total}`}</span>
                        </div>
                        <div class="tile-name">${esc(name)}</div>
                        <div class="tile-bar"><i style="width:${pct}%"></i></div>
                    </button>`;
            };
            let tabsHtml = tileHtml('ALL', '<i class="ph-bold ph-list-checks"></i>', '전체', 'var(--accent)', doneCount, totalCount);
            CATEGORIES.forEach(cat => {
                const catItems = SPREADSHEET_ITEMS.filter(i => i.code === cat.code);
                const done = catItems.filter(i => checkedMap[i.id]).length;
                tabsHtml += tileHtml(cat.code, esc(cat.code), cat.name, cat.color, done, catItems.length);
            });
            const tilesBar = document.getElementById('categoryTabsBar');
            tilesBar.innerHTML = tabsHtml;
            // 카테고리를 바꾼 경우에만 선택된 타일을 가로 스크롤 가운데로 이동
            if (lastCenteredCategory !== appState.selectedCategory) {
                lastCenteredCategory = appState.selectedCategory;
                const activeTile = tilesBar.querySelector('.tile.active');
                if (activeTile && tilesBar.scrollWidth > tilesBar.clientWidth) {
                    tilesBar.scrollTo({ left: activeTile.offsetLeft - (tilesBar.clientWidth - activeTile.offsetWidth) / 2, behavior: 'smooth' });
                }
            }

            // 4-1. '전체' 선택 시 상단 고정 해제하여 스크롤 시 위로 사라지게 함
            const chipbarEl = document.querySelector('.chipbar');
            if (chipbarEl) {
                chipbarEl.classList.toggle('not-sticky', appState.selectedCategory === 'ALL');
            }

            // 5. 하단 버튼
            document.getElementById('bottomBtn-all').classList.toggle('active', appState.selectedCategory === 'ALL');
            const grandAtt = getServiceSubtotal('att1') + getServiceSubtotal('att2') + getServiceSubtotal('att3') + getServiceSubtotal('attDawn');
            document.getElementById('bottomAttBadge').textContent = grandAtt;
        }

        function renderChecklist() {
            if (!SPREADSHEET_ITEMS.length) return;
            const container = document.getElementById('checklistContainer');
            const checkedMap = appState.checkedByService[appState.currentService] || {};
            const query = appState.searchQuery.toLowerCase();
            const isAll = appState.selectedCategory === 'ALL';

            const targetCategories = isAll
                ? CATEGORIES
                : CATEGORIES.filter(c => c.code === appState.selectedCategory);

            let html = '';
            let totalVisibleItems = 0;

            targetCategories.forEach(cat => {
                let items = SPREADSHEET_ITEMS.filter(i => i.code === cat.code);
                const totalInCategory = items.length;
                const doneInCategory = items.filter(i => checkedMap[i.id]).length;

                if (appState.filterUnchecked) items = items.filter(i => !checkedMap[i.id]);
                if (query) {
                    items = items.filter(i =>
                        i.text.toLowerCase().includes(query) ||
                        i.category.toLowerCase().includes(query) ||
                        i.code.toLowerCase().includes(query)
                    );
                }
                if (items.length === 0) return;
                totalVisibleItems += items.length;

                const isCollapsed = isAll && !!appState.collapsedGroups[cat.code] && !query;
                const allGroupDone = doneInCategory === totalInCategory;
                const groupPct = totalInCategory ? (doneInCategory / totalInCategory) * 100 : 0;
                const code = esc(cat.code);

                html += `
                    <section id="cat-section-${code}" class="group ${allGroupDone ? 'all-done' : ''}" style="--c:${cat.color}">
                        <div class="group-head">
                            <${isAll ? `button onclick="toggleGroupCollapse('${code}')"` : 'div'} class="gh-main">
                                <span class="gh-code">${allGroupDone ? '<i class="ph-bold ph-check"></i>' : code}</span>
                                <div class="gh-text">
                                    <div class="gh-name">${esc(cat.name)} <small>${doneInCategory}/${totalInCategory}</small></div>
                                    <div class="gh-meter"><div style="width:${groupPct}%"></div></div>
                                </div>
                            </${isAll ? 'button' : 'div'}>
                            <button class="gh-btn" onclick="toggleCategoryGroupAll('${code}')">${allGroupDone ? '전체 해제' : '모두 완료'}</button>
                            ${isAll ? `<button class="gh-chev ${isCollapsed ? 'collapsed' : ''}" onclick="toggleGroupCollapse('${code}')" aria-label="접기/펼치기"><i class="ph-bold ph-caret-down"></i></button>` : ''}
                        </div>
                        ${isCollapsed ? '' : `<div class="items">${items.map(item => renderSingleItemCard(item, checkedMap, !!query)).join('')}</div>`}
                    </section>`;
            });

            if (totalVisibleItems === 0) {
                const searching = !!query;
                html = `
                    <div class="empty">
                        <div class="big-icon ${searching ? 'load' : ''}"><i class="ph-bold ${searching ? 'ph-magnifying-glass' : 'ph-check-fat'}"></i></div>
                        <h3>${searching ? '검색 결과가 없습니다' : '남은 항목이 없습니다!'}</h3>
                        <p>${searching ? `'${esc(appState.searchQuery)}'에 해당하는 작업을 찾지 못했어요.` : '이 범위의 작업을 모두 완료했어요. 수고하셨습니다.'}</p>
                        ${appState.filterUnchecked ? `<button class="pill-btn" onclick="toggleFilterUnchecked()"><i class="ph-bold ph-eye"></i>완료된 항목도 보기</button>` : ''}
                    </div>`;
            }

            container.innerHTML = html;
        }

        function renderSingleItemCard(item, checkedMap, showCategory) {
            const isChecked = !!checkedMap[item.id];

            let tags = '';
            if (item.urgent) tags += `<span class="tag urgent"><i class="ph-fill ph-alarm"></i>${esc(item.urgent)}</span>`;
            if (item.badge) tags += `<span class="tag note"><i class="ph-bold ph-push-pin"></i>${esc(item.badge)}</span>`;
            if (showCategory) tags += `<span class="tag cat">${esc(item.code)}. ${esc(item.category)}</span>`;

            let action = '';
            if (item.actionType === 'attendanceModal') {
                action = `
                    <div class="item-action">
                        <span class="stat">1부 <b>${getServiceSubtotal('att1')}</b> · 2부 <b>${getServiceSubtotal('att2')}</b> · 오후 <b>${getServiceSubtotal('att3')}</b></span>
                        <button class="pill-btn green" onclick="event.stopPropagation(); openAttendanceModal()"><i class="ph-bold ph-users-three"></i>계수기 열기</button>
                    </div>`;
            } else if (item.actionType === 'offeringManual') {
                action = `
                    <div class="item-action" style="justify-content:flex-end">
                        <button class="pill-btn" onclick="event.stopPropagation(); openOfferingManualModal()"><i class="ph-bold ph-list-numbers"></i>단계별로 보기</button>
                    </div>`;
            }

            const pInfo = photoCache[item.id];
            const pCount = pInfo ? pInfo.count : 0;
            const pPending = pInfo ? pInfo.pending : 0;
            const photoTitle = pPending ? `사진 ${pCount}장 (${pPending}장 드라이브 저장 대기)` : `사진 ${pCount}장 보기/추가`;
            const photoBtnHtml = pCount > 0
                ? `<button class="photo-btn has-photo" onclick="event.stopPropagation(); openPhotoModal('${item.id}')" title="${photoTitle}" aria-label="${photoTitle}">
                     <div class="photo-thumb-wrap">
                         <img src="${pInfo.latestThumb}" class="photo-thumb" alt="사진" referrerpolicy="no-referrer" />
                         <span class="photo-badge ${pPending ? 'pending' : ''}">${pPending ? '!' : pCount}</span>
                     </div>
                   </button>`
                : `<button class="photo-btn" onclick="event.stopPropagation(); openPhotoModal('${item.id}')" title="사진 촬영/첨부" aria-label="사진 촬영/첨부">
                     <i class="ph-bold ph-camera"></i>
                   </button>`;

            return `
                <div class="item ${isChecked ? 'done' : ''} ${item.urgent ? 'urgent' : ''} ${lastToggledId === item.id ? 'pop' : ''}"
                     id="item-${item.id}" role="checkbox" tabindex="0" aria-checked="${isChecked}"
                     onclick="toggleItemCheck('${item.id}')" onkeydown="itemKeydown(event, '${item.id}')">
                    <div class="check"><i class="ph-bold ph-check"></i></div>
                    <div class="item-body">
                        <div class="item-text">${esc(item.text)}</div>
                        ${tags ? `<div class="tags">${tags}</div>` : ''}
                        ${action}
                    </div>
                    <div class="item-right">
                        ${photoBtnHtml}
                    </div>
                </div>`;
        }

        // === 모달 공통 ===
        function openSheet(id) {
            document.getElementById(id).classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        function closeSheet(id) {
            document.getElementById(id).classList.add('hidden');
            if (!document.querySelector('.backdrop:not(.hidden)')) document.body.style.overflow = '';
        }

        // === 공통 확인/안내 대화상자 (Promise<boolean>) ===
        let confirmResolver = null;
        function appConfirm({ title, desc = '', okText = '확인', cancelText = '취소', icon = 'ph-question', tone = 'danger' }) {
            if (confirmResolver) confirmResolver(false);
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmDesc').textContent = desc;
            const iconBox = document.getElementById('confirmIcon');
            iconBox.className = `big-icon ${tone}`;
            iconBox.innerHTML = `<i class="ph-bold ${icon}"></i>`;
            const okBtn = document.getElementById('confirmOkBtn');
            okBtn.textContent = okText;
            okBtn.className = `big-btn ${tone === 'danger' ? 'red' : 'primary'}`;
            const cancelBtn = document.getElementById('confirmCancelBtn');
            cancelBtn.classList.toggle('hidden', !cancelText);
            if (cancelText) cancelBtn.textContent = cancelText;
            document.getElementById('confirmBtnRow').style.gridTemplateColumns = cancelText ? '' : '1fr';
            openSheet('confirmModal');
            setTimeout(() => okBtn.focus(), 50);
            return new Promise(resolve => { confirmResolver = resolve; });
        }

        function appAlert({ title, desc = '', okText = '확인', icon = 'ph-info' }) {
            return appConfirm({ title, desc, okText, cancelText: null, icon, tone: 'primary' });
        }

        function resolveConfirm(ok) {
            closeSheet('confirmModal');
            const resolve = confirmResolver;
            confirmResolver = null;
            if (resolve) resolve(ok);
        }

        // === 되돌리기 (체크·출석 스냅샷) ===
        function snapshotRecords() {
            return JSON.stringify({ checkedByService: appState.checkedByService, attendance: appState.attendance });
        }

        function restoreRecords(snap) {
            const s = JSON.parse(snap);
            appState.checkedByService = s.checkedByService;
            appState.attendance = s.attendance;
            wasComplete = isServiceComplete();
            saveState();
            renderAll();
            if (!document.getElementById('attendanceModal').classList.contains('hidden')) renderAttendanceModal();
            showToast('되돌렸습니다.', 'ph-arrow-u-up-left');
        }

        function showUndoToast(msg, icon, snap) {
            showToast(msg, icon, { undo: () => restoreRecords(snap) });
        }

        // === 출석 계수기 ===
        function openAttendanceModal() {
            renderAttendanceModal();
            openSheet('attendanceModal');
        }

        function closeAttendanceModal() {
            closeSheet('attendanceModal');
            renderAll();
        }

        function selectAttService(attKey) {
            appState.currentAttTab = attKey;
            saveState();
            renderAttendanceModal();
        }

        function adjustCount(field, delta) {
            const tab = appState.currentAttTab;
            const currentVal = appState.attendance[tab][field] || 0;
            appState.attendance[tab][field] = Math.max(0, currentVal + delta);
            buzz(8);
            saveState();
            renderAttendanceModal();
        }

        function setDirectCount(field, valStr) {
            const tab = appState.currentAttTab;
            const num = parseInt(valStr, 10);
            appState.attendance[tab][field] = isNaN(num) || num < 0 ? 0 : num;
            saveState();
            renderAttendanceModal();
        }

        function getServiceSubtotal(attKey) {
            const d = appState.attendance[attKey] || { male: 0, female: 0, broadcast: 0 };
            return (d.male || 0) + (d.female || 0) + (d.broadcast || 0);
        }

        function renderAttendanceModal() {
            // 구글 드라이브 연동 상태 배너 갱신
            const driveUrl = getDriveWebhookUrl();
            const attBannerStatus = document.getElementById('attDriveBannerStatus');
            const attBannerText = document.getElementById('attDriveBannerText');
            if (attBannerStatus && attBannerText) {
                if (driveUrl) {
                    attBannerStatus.className = 'drive-status-info connected';
                    attBannerText.textContent = '구글 드라이브 (\\예배부 데이터\\출석) 연동됨';
                } else {
                    attBannerStatus.className = 'drive-status-info disconnected';
                    attBannerText.textContent = '구글 드라이브 미연동 (클릭하여 설정)';
                }
            }
            const tabs = [
                { key: 'att1', label: '1부' },
                { key: 'att2', label: '2부' },
                { key: 'att3', label: '오후' },
                { key: 'attDawn', label: '특새' }
            ];
            tabs.forEach(t => {
                const btn = document.getElementById(`attTab-${t.key}`);
                btn.innerHTML = `${t.label}<span>${getServiceSubtotal(t.key)}명</span>`;
                btn.classList.toggle('active', appState.currentAttTab === t.key);
            });
            const curTab = tabs.find(t => t.key === appState.currentAttTab);
            document.getElementById('attTotalLabel').textContent = `${curTab.label} 합계`;
            document.getElementById('attTotalNum').textContent = getServiceSubtotal(appState.currentAttTab);
            document.getElementById('attDoneLabel').textContent = `${curTab.label} 출석체크 완료`;

            const currentData = appState.attendance[appState.currentAttTab];
            const fields = [
                { key: 'male', label: '남자', hint: '방송실, 성가대 포함', icon: 'ph-gender-male', color: '#2563eb' },
                { key: 'female', label: '여자', hint: '방송실, 성가대 포함', icon: 'ph-gender-female', color: '#e11d48' },
                { key: 'broadcast', label: '인터넷', hint: '인터넷 예배', icon: 'ph-globe', color: '#059669' }
            ];

            document.getElementById('counterCardsContainer').innerHTML = fields.map(f => `
                <div class="card counter" style="--c:${f.color}">
                    <div class="counter-head">
                        <span class="counter-label"><i class="ph-bold ${f.icon}"></i>${f.label}</span>
                        <span class="counter-hint">${f.hint}</span>
                    </div>
                    <div class="counter-row">
                        <button class="cbtn" onclick="adjustCount('${f.key}', -5)">−5</button>
                        <button class="cbtn" onclick="adjustCount('${f.key}', -1)" aria-label="1 감소"><i class="ph-bold ph-minus"></i></button>
                        <input class="cval" type="number" inputmode="numeric" value="${currentData[f.key] || 0}" onchange="setDirectCount('${f.key}', this.value)" onfocus="this.select()" />
                        <button class="cbtn plus" onclick="adjustCount('${f.key}', 1)" aria-label="1 증가"><i class="ph-bold ph-plus"></i></button>
                        <button class="cbtn" onclick="adjustCount('${f.key}', 5)">+5</button>
                    </div>
                </div>`).join('');

            const s1 = appState.attendance.att1 || { male: 0, female: 0, broadcast: 0 };
            const s2 = appState.attendance.att2 || { male: 0, female: 0, broadcast: 0 };
            const s3 = appState.attendance.att3 || { male: 0, female: 0, broadcast: 0 };
            const sd = appState.attendance.attDawn || { male: 0, female: 0, broadcast: 0 };
            const sub1 = getServiceSubtotal('att1');
            const sub2 = getServiceSubtotal('att2');
            const sub3 = getServiceSubtotal('att3');
            const subd = getServiceSubtotal('attDawn');
            const grand = sub1 + sub2 + sub3 + subd;

            const dateStr = document.getElementById('currentDateText').textContent;
            document.getElementById('attendanceSummaryPreview').textContent =
                `[예배부 출석체크] ${dateStr}\n` +
                `• 1부: ${sub1}명 (남자 ${s1.male || 0} / 여자 ${s1.female || 0} / 인터넷 ${s1.broadcast || 0})\n` +
                `• 2부: ${sub2}명 (남자 ${s2.male || 0} / 여자 ${s2.female || 0} / 인터넷 ${s2.broadcast || 0})\n` +
                `• 오후: ${sub3}명 (남자 ${s3.male || 0} / 여자 ${s3.female || 0} / 인터넷 ${s3.broadcast || 0})\n` +
                `• 특새: ${subd}명 (남자 ${sd.male || 0} / 여자 ${sd.female || 0} / 인터넷 ${sd.broadcast || 0})\n` +
                `▶ 총계: ${grand}명 (방송실, 성가대 포함, 인터넷 예배 포함)`;
        }

        async function resetAttendance() {
            const ok = await appConfirm({
                title: '출석 인원 초기화',
                desc: '1부·2부·오후·특새 출석 인원을 모두 0으로 초기화할까요?',
                okText: '초기화',
                icon: 'ph-arrow-counter-clockwise'
            });
            if (!ok) return;
            const snap = snapshotRecords();
            appState.attendance = {
                att1: { male: 0, female: 0, broadcast: 0 },
                att2: { male: 0, female: 0, broadcast: 0 },
                att3: { male: 0, female: 0, broadcast: 0 },
                attDawn: { male: 0, female: 0, broadcast: 0 }
            };
            saveState();
            renderAttendanceModal();
            showUndoToast('출석 인원이 모두 0으로 초기화되었습니다.', 'ph-arrow-counter-clockwise', snap);
        }

        function legacyCopy(text) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { }
            document.body.removeChild(textarea);
            return ok;
        }

        async function copyAttendanceReport() {
            const text = document.getElementById('attendanceSummaryPreview').textContent;
            let ok = false;
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    ok = true;
                }
            } catch (e) { }
            if (!ok) ok = legacyCopy(text);
            showToast(ok ? '출석체크 내역이 복사되었습니다!' : '복사에 실패했습니다.', ok ? 'ph-copy' : 'ph-warning-circle');
        }

        // 출석 집계표 텍스트 생성
        function generateAttendanceReportContent() {
            const srvMap = { att1: '1부예배', att2: '2부예배', att3: '오후예배', attDawn: '특별새벽기도' };
            const curTab = appState.currentAttTab || 'att1';
            const srvTitle = srvMap[curTab] || '1부예배';
            const curData = appState.attendance[curTab] || { male: 0, female: 0, broadcast: 0 };
            const maleCnt = curData.male || 0;
            const femaleCnt = curData.female || 0;
            const internetCnt = curData.broadcast || 0;
            const subTotal = maleCnt + femaleCnt + internetCnt;

            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            const fileName = `${dateStr}-${srvTitle}.txt`;

            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dayOfWeek = days[now.getDay()];
            const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const fileContent =
                `========================================
성광교회 ${srvTitle} 출석 집계표
========================================
■ 일시: ${dateStr} (${dayOfWeek}요일)
■ 예배: ${srvTitle}
■ 기록시각: ${timeStr}

----------------------------------------
[인원 현황]
• 남자: ${maleCnt}명 (방송실, 성가대 포함)
• 여자: ${femaleCnt}명 (방송실, 성가대 포함)
• 인터넷: ${internetCnt}명 (인터넷 예배)
----------------------------------------
▶ 총 인원 합계: ${subTotal}명
========================================
`;
            return { srvTitle, dateStr, fileName, fileContent, subTotal };
        }

        // 출석 집계표 파일 구글 드라이브 (\예배부 데이터) 업로드
        async function uploadAttendanceReportToDrive(fileName, fileContent) {
            const webhookUrl = getDriveWebhookUrl();
            if (!webhookUrl) {
                return { success: false, needConfig: true };
            }

            try {
                const utf8Bytes = encodeURIComponent(fileContent).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1));
                const base64Data = btoa(utf8Bytes);
                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        type: 'attendance',
                        subFolder: '출석',
                        text: fileContent,
                        base64: base64Data,
                        mimeType: 'text/plain;charset=utf-8',
                        fileName: fileName
                    })
                });

                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                return data;
            } catch (err) {
                console.error('Drive attendance upload error:', err);
                return { success: false, error: err.message };
            }
        }

        // 브라우저 파일 로컬 다운로드 트리거
        function downloadAttendanceTextFile(fileName, fileContent) {
            try {
                const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
                const blobUrl = URL.createObjectURL(blob);
                const dlLink = document.createElement('a');
                dlLink.href = blobUrl;
                dlLink.download = fileName;
                document.body.appendChild(dlLink);
                dlLink.click();
                document.body.removeChild(dlLink);
                URL.revokeObjectURL(blobUrl);
                return true;
            } catch (e) {
                console.error('Download error:', e);
                return false;
            }
        }

        // 출석체크 완료: [날짜-x부예배] 파일을 드라이브에 기록 (미연동·실패 시에만 기기에 저장)
        async function markAttendanceTaskDone() {
            // 파일은 계수기에서 선택한 탭 기준으로 만들어지므로, 체크도 같은 예배에 표시
            const attToSrv = { att1: 'service1', att2: 'service2', att3: 'afternoon', attDawn: 'dawn' };
            const srv = attToSrv[appState.currentAttTab] || appState.currentService;
            if (!appState.checkedByService[srv]) appState.checkedByService[srv] = {};
            const attItem = SPREADSHEET_ITEMS.find(i => i.actionType === 'attendanceModal');
            if (attItem) appState.checkedByService[srv][attItem.id] = true;

            const { fileName, fileContent } = generateAttendanceReportContent();

            closeSheet('attendanceModal');
            if (srv !== appState.currentService) {
                saveState();
                renderAll();
            } else {
                afterCheckChange();
            }
            buzz([20, 50, 20]);

            if (!getDriveWebhookUrl()) {
                downloadAttendanceTextFile(fileName, fileContent);
                showToast(`${fileName} 기기에 저장되었습니다 (드라이브 미연동)`, 'ph-file-text');
                return;
            }
            showToast(`${fileName} 드라이브에 기록 중...`, 'ph-spinner-gap spin');
            const res = await uploadAttendanceReportToDrive(fileName, fileContent);
            if (res && res.success) {
                showToast(`${SERVICE_NAMES[srv]} 출석 완료 · 드라이브(\\예배부 데이터\\출석)에 기록했습니다.`, 'ph-cloud-check');
            } else {
                downloadAttendanceTextFile(fileName, fileContent);
                showToast('드라이브 기록 실패 – 기기에 파일로 저장했습니다.', 'ph-warning-circle');
            }
        }
        // ==========================================

function isFirstSunday(d = new Date()) {
            return d.getDay() === 0 && d.getDate() >= 1 && d.getDate() <= 7;
        }

        function checkFirstSundayNotice() {
            const urlParams = new URLSearchParams(window.location.search);
            const urlKey = urlParams.get('setGeminiKey');
            if (urlKey) {
                localStorage.setItem(GEMINI_API_KEY_STORAGE, urlKey.trim());
                // 키가 방문 기록·북마크·공유 링크에 남지 않도록 주소창에서 즉시 제거
                urlParams.delete('setGeminiKey');
                const qs = urlParams.toString();
                history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
                showToast('Gemini API 키가 성공적으로 등록되었습니다!', 'ph-check-circle');
            }
            const isTest = urlParams.get('testFirstSunday') === '1' || !!urlKey;
            const now = new Date();
            const isTarget = isFirstSunday(now) || isTest;

            const pill = document.getElementById('firstSundayPill');
            if (pill) {
                if (isTarget) pill.classList.remove('hidden');
                else pill.classList.add('hidden');
            }

            if (!isTarget) return;

            const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const sessionKey = 'first_sunday_checked_' + todayKey;

            // 이번 세션에서 확인한 적이 없으면 자동 팝업
            if (isTest || !sessionStorage.getItem(sessionKey)) {
                setTimeout(() => {
                    openFirstSundayModal();
                }, 500);
            }
        }

        function openFirstSundayModal() {
            const now = new Date();
            const month = now.getMonth() + 1;
            const titleEl = document.getElementById('firstSundayTitle');
            const badgeEl = document.getElementById('firstSundayBadgeText');
            if (titleEl) titleEl.textContent = `${month}월 첫번째 주일 체크사항`;
            if (badgeEl) badgeEl.textContent = `${month}월 첫째 주일 알림`;

            // 실시간 AI 덕담 생성 실행
            refreshChoirQuotes(false);

            openSheet('firstSundayModal');
        }

        function closeFirstSundayModal() {
            closeSheet('firstSundayModal');
        }

        function confirmFirstSundayModal() {
            const now = new Date();
            const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            sessionStorage.setItem('first_sunday_checked_' + todayKey, 'true');
            closeFirstSundayModal();
            showToast('첫번째 주일 알림을 확인했습니다.', 'ph-calendar-star');
        }

        function openOfferingManualModal() { openSheet('offeringModal'); }
        function closeOfferingManualModal() { closeSheet('offeringModal'); }

        async function openResetModal() {
            const name = SERVICE_NAMES[appState.currentService];
            const ok = await appConfirm({
                title: `${name} 초기화`,
                desc: `${name}의 체크 표시와 출석 인원을 모두 초기화할까요?`,
                okText: '초기화',
                icon: 'ph-arrow-counter-clockwise'
            });
            if (ok) confirmResetService();
        }

        function confirmResetService() {
            const curSrv = appState.currentService;
            const name = SERVICE_NAMES[curSrv];
            const snap = snapshotRecords();

            // 1. 체크 표시 초기화
            appState.checkedByService[curSrv] = {};
            wasComplete = false;

            // 2. 해당 예배 출석 인원(남자, 여자, 인터넷) 0으로 초기화
            const srvToAtt = {
                service1: 'att1',
                service2: 'att2',
                afternoon: 'att3',
                dawn: 'attDawn'
            };
            const attKey = srvToAtt[curSrv];
            if (attKey && appState.attendance) {
                appState.attendance[attKey] = { male: 0, female: 0, broadcast: 0 };
            }

            saveState();
            renderAll();
            renderAttendanceModal();
            showUndoToast(`${name} 체크 및 출석 인원이 초기화되었습니다.`, 'ph-arrow-counter-clockwise', snap);
        }

        // === 더보기 메뉴 ===
        function toggleMoreMenu(e) {
            if (e) e.stopPropagation();
            const menu = document.getElementById('moreMenu');
            const open = menu.classList.contains('hidden');
            menu.classList.toggle('hidden', !open);
            document.getElementById('moreBtn').setAttribute('aria-expanded', String(open));
        }

        function closeMoreMenu() {
            document.getElementById('moreMenu').classList.add('hidden');
            document.getElementById('moreBtn').setAttribute('aria-expanded', 'false');
        }

        document.addEventListener('click', e => {
            if (!e.target.closest('.more-wrap')) closeMoreMenu();
        });

        // === 통합 설정 ===
        function refreshSettingsStatus() {
            const ai = document.getElementById('settingsAiStatus');
            const drive = document.getElementById('settingsDriveStatus');
            if (ai) {
                const hasKey = !!getGeminiApiKey();
                ai.textContent = hasKey ? '등록됨 · 실시간 AI 생성 사용 중' : '미등록 · 기본 내장 문구로 동작';
                ai.classList.toggle('on', hasKey);
            }
            if (drive) {
                const url = getDriveWebhookUrl();
                let custom = false;
                try { custom = !!localStorage.getItem(DRIVE_WEBHOOK_KEY); } catch (e) { }
                drive.textContent = !url ? '미연동 · 기기에만 저장' : (custom ? '연동됨 · 직접 설정한 주소' : '연동됨 · 기본 주소');
                drive.classList.toggle('on', !!url);
            }
            const installRow = document.getElementById('settingsInstallRow');
            if (installRow) installRow.classList.toggle('hidden', isRunningStandalone());
        }

        function openSettingsModal() {
            refreshSettingsStatus();
            applyTheme();
            openSheet('settingsModal');
        }

        // === 화면 테마 (auto | light | dark) — 첫 적용은 index.html <head>의 인라인 스크립트 ===
        const THEME_KEY = 'APP_THEME';
        const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

        function getThemePref() {
            try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; }
        }

        function applyTheme() {
            const pref = getThemePref();
            const dark = pref === 'dark' || (pref === 'auto' && darkQuery.matches);
            document.documentElement.classList.toggle('dark', dark);
            ['auto', 'light', 'dark'].forEach(k => {
                const btn = document.getElementById(`theme-${k}`);
                if (!btn) return;
                btn.classList.toggle('active', k === pref);
                btn.setAttribute('aria-checked', String(k === pref));
            });
        }

        function setTheme(pref) {
            try { localStorage.setItem(THEME_KEY, pref); } catch (e) { }
            applyTheme();
        }

        darkQuery.addEventListener('change', applyTheme);

        function closeSettingsModal() { closeSheet('settingsModal'); }

        // === 새 예배일 시작 확인 (지난 기록 자동 정리) ===
        function dateKey(d = new Date()) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        function hasAnyRecords() {
            const anyCheck = Object.values(appState.checkedByService).some(m => Object.values(m || {}).some(Boolean));
            return anyCheck || ['att1', 'att2', 'att3', 'attDawn'].some(k => getServiceSubtotal(k) > 0);
        }

        let newDayPromptOpen = false;
        async function checkNewDay() {
            const today = dateKey();
            const last = appState.lastActiveDate;
            if (newDayPromptOpen || last === today) return;
            if (!last || !hasAnyRecords()) {
                appState.lastActiveDate = today;
                saveState();
                return;
            }
            newDayPromptOpen = true;
            const [, m, d] = last.split('-').map(Number);
            const ok = await appConfirm({
                title: '새 예배일이에요',
                desc: `지난 기록(${m}월 ${d}일)이 남아 있습니다.\n모든 예배의 체크와 출석 인원을 지우고 새로 시작할까요?`,
                okText: '새로 시작',
                cancelText: '이어서 하기',
                icon: 'ph-calendar-check',
                tone: 'primary'
            });
            newDayPromptOpen = false;
            appState.lastActiveDate = today;
            if (ok) {
                const snap = snapshotRecords();
                Object.keys(appState.checkedByService).forEach(k => { appState.checkedByService[k] = {}; });
                Object.keys(appState.attendance).forEach(k => { appState.attendance[k] = { male: 0, female: 0, broadcast: 0 }; });
                wasComplete = false;
                saveState();
                renderAll();
                showUndoToast('지난 기록을 지우고 새로 시작합니다.', 'ph-sparkle', snap);
            } else {
                saveState();
            }
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' || !SPREADSHEET_ITEMS.length) return;
            checkNewDay();
            retryPendingUploads();
        });

        // === 스크롤 시 축소 진행률 바 ===
        function initMiniBar() {
            const target = document.querySelector('.progress-card');
            if (!target || !('IntersectionObserver' in window)) return;
            new IntersectionObserver(([entry]) => {
                const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
                document.body.classList.toggle('mini-on', show);
            }).observe(target);
        }

        // 체크 기록은 그대로 두고 구글 시트의 최신 목록만 다시 불러옴
        async function refreshSheetData() {
            const btn = document.getElementById('refreshBtn');
            const icon = btn.querySelector('i');
            btn.disabled = true;
            icon.className = 'ph-bold ph-spinner-gap spin';
            showToast('구글 시트에서 최신 목록을 불러오는 중...', 'ph-cloud-arrow-down');
            const ok = await loadSheetData(true);
            await syncPhotosFromDrive();
            wasComplete = isServiceComplete();
            btn.disabled = false;
            icon.className = 'ph-bold ph-cloud-arrow-down';
            if (ok) showToast(`최신 목록 ${SPREADSHEET_ITEMS.length}개를 불러왔습니다.`, 'ph-cloud-check');
            else showToast('시트 연결에 실패해 저장된 목록으로 표시합니다.', 'ph-wifi-slash');
        }

        let toastTimer = null;
        let toastUndoFn = null;
        // opts.undo: 함수를 넘기면 [되돌리기] 버튼을 붙이고 더 오래 표시
        function showToast(msg, icon, opts) {
            const toast = document.getElementById('toast');
            toast.querySelector('i').className = `ph-fill ${icon || 'ph-check-circle'}`;
            document.getElementById('toastMsg').textContent = msg;
            toastUndoFn = (opts && opts.undo) || null;
            document.getElementById('toastUndo').classList.toggle('hidden', !toastUndoFn);
            toast.classList.add('hidden');
            void toast.offsetWidth; // 애니메이션 재시작
            toast.classList.remove('hidden');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => { toast.classList.add('hidden'); toastUndoFn = null; }, toastUndoFn ? 5000 : 2400);
        }

        function runToastUndo() {
            const fn = toastUndoFn;
            toastUndoFn = null;
            document.getElementById('toast').classList.add('hidden');
            if (fn) fn();
        }

        function renderAll() {
            renderHeaderAndTabs();
            renderChecklist();
        }


        document.addEventListener('keydown', e => {
            if (!document.getElementById('photoViewerModal').classList.contains('hidden')) {
                if (e.key === 'ArrowLeft') { viewerPrevPhoto(); return; }
                if (e.key === 'ArrowRight') { viewerNextPhoto(); return; }
            }
            if (e.key !== 'Escape') return;
            if (!document.getElementById('confirmModal').classList.contains('hidden')) resolveConfirm(false);
            else if (!document.getElementById('moreMenu').classList.contains('hidden')) closeMoreMenu();
            else if (!document.getElementById('choirQuoteModal').classList.contains('hidden')) closeChoirQuoteModal();
            else if (!document.getElementById('bibleVerseModal').classList.contains('hidden')) closeBibleVerseModal();
            else if (!document.getElementById('photoViewerModal').classList.contains('hidden')) closePhotoViewer();
            else if (!document.getElementById('geminiKeyModal').classList.contains('hidden')) closeGeminiApiKeyModal();
            else if (!document.getElementById('firstSundayModal').classList.contains('hidden')) closeFirstSundayModal();
            else if (!document.getElementById('photoModal').classList.contains('hidden')) closePhotoModal();
            else if (!document.getElementById('driveConfigModal').classList.contains('hidden')) closeDriveConfigModal();
            else if (!document.getElementById('settingsModal').classList.contains('hidden')) closeSettingsModal();
            else if (!document.getElementById('attendanceModal').classList.contains('hidden')) closeAttendanceModal();
            else if (!document.getElementById('offeringModal').classList.contains('hidden')) closeOfferingManualModal();
        });


        // ==========================================
        // PWA (Progressive Web App) 설치 & 독립 실행(Standalone)
        // ==========================================
        let deferredPrompt = null;

        // 브라우저가 독립 실행형(PWA)으로 실행 중인지 감지
        function isRunningStandalone() {
            return (window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone === true);
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const installBtn = document.getElementById('pwaInstallBtn');
            if (installBtn && !isRunningStandalone()) {
                installBtn.style.display = 'inline-flex';
            }
        });

        async function triggerPwaInstall() {
            if (!deferredPrompt) {
                const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
                appAlert({
                    title: '홈 화면에 앱 설치',
                    desc: isIos
                        ? '사파리 하단의 [공유] 아이콘을 누른 후 [홈 화면에 추가]를 누르면 주소창 없이 앱으로 실행됩니다.'
                        : '브라우저 주소창 우측의 [설치] 아이콘 또는 메뉴(점 3개)의 [홈 화면에 추가]를 누르면 주소창 없이 앱으로 실행됩니다.',
                    icon: 'ph-device-mobile'
                });
                return;
            }
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                showToast('앱이 성공적으로 설치되었습니다! 🎉', 'ph-check-circle');
                const installBtn = document.getElementById('pwaInstallBtn');
                if (installBtn) installBtn.style.display = 'none';
            }
            deferredPrompt = null;
        }

        window.addEventListener('appinstalled', () => {
            showToast('홈 화면에 예배부 앱이 설치되었습니다! 🎉', 'ph-check-circle');
            const installBtn = document.getElementById('pwaInstallBtn');
            if (installBtn) installBtn.style.display = 'none';
        });

        // Service Worker 등록 + 새 버전 감지 시 "새 버전이 있어요 — 새로고침" 안내
        let swRegistration = null;
        let reloadingForUpdate = false;

        function showUpdateBanner() {
            document.getElementById('updateBanner').classList.remove('hidden');
        }

        function applyAppUpdate() {
            const waiting = swRegistration && swRegistration.waiting;
            reloadingForUpdate = true;
            if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' }); // 활성화되면 controllerchange에서 새로고침
            else location.reload();
        }

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
                    swRegistration = reg;
                    // 기존 버전이 화면을 제어 중일 때 새 버전이 설치 완료되면 안내 (첫 설치는 제외)
                    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();
                    reg.addEventListener('updatefound', () => {
                        const sw = reg.installing;
                        if (!sw) return;
                        sw.addEventListener('statechange', () => {
                            if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner();
                        });
                    });
                }).catch((err) => {
                    console.warn('SW registration skipped:', err);
                });
            });
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (reloadingForUpdate) location.reload();
            });
            // 앱을 오래 켜 둔 경우: 화면으로 돌아올 때마다 새 버전 확인
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && swRegistration) swRegistration.update().catch(() => { });
            });
        }

        window.onload = async function () {
            // 브라우저 자동완성(Autofill)으로 검색창에 이메일/계정이 들어가는 현상 원천 차단
            const searchInputEl = document.getElementById('searchInput');
            if (searchInputEl) {
                searchInputEl.value = '';
                appState.searchQuery = '';
            }
            setTimeout(() => {
                const sEl = document.getElementById('searchInput');
                if (sEl && sEl.value && appState.searchQuery === '') {
                    sEl.value = '';
                    handleSearch('');
                }
            }, 250);

            loadState();
            updateDateDisplay();
            checkFirstSundayNotice();
            await initPhotoDB();
            await refreshPhotoCache();
            updateDriveBannerStatus();
            renderHeaderAndTabs();
            initMiniBar();
            loadSheetData().then(() => {
                wasComplete = isServiceComplete();
                checkNewDay();
                syncPhotosFromDrive().then(retryPendingUploads);
            });
        };

