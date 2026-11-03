// ==========================================
// 구글 드라이브 & 사진 첨부/뷰어 모듈
// ==========================================

// 사진 첨부 및 구글 드라이브 연동 모듈
        // ==========================================
        // V2: 기기에 남아 있는 구버전 URL(이전 키)은 무시하고, 이 키로 새로 저장한 값만 기본값보다 우선 적용
        const DRIVE_WEBHOOK_KEY = 'CHURCH_WORSHIP_DRIVE_WEBHOOK_URL_V2';
        const PHOTO_DB_NAME = 'ChurchWorshipPhotoDB';
        const PHOTO_STORE_NAME = 'photos';
        const PHOTO_DB_VERSION = 1;

        let photoDB = null;
        let photoCache = {}; // { [itemId]: { count: number, latestThumb: string } }
        let currentPhotoItemId = null;
        let activeViewerDriveUrl = null;

        // IndexedDB 초기화
        function initPhotoDB() {
            return new Promise((resolve) => {
                if (!window.indexedDB) {
                    console.warn('IndexedDB not supported in this browser.');
                    resolve(null);
                    return;
                }
                const request = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
                        const store = db.createObjectStore(PHOTO_STORE_NAME, { keyPath: 'id' });
                        store.createIndex('itemId', 'itemId', { unique: false });
                        store.createIndex('createdAt', 'createdAt', { unique: false });
                    }
                };
                request.onsuccess = (e) => {
                    photoDB = e.target.result;
                    resolve(photoDB);
                };
                request.onerror = (e) => {
                    console.error('IndexedDB open error:', e);
                    resolve(null);
                };
            });
        }

        // 특정 항목의 사진 목록 가져오기
        function getPhotosByItemId(itemId) {
            return new Promise((resolve) => {
                if (!photoDB) { resolve([]); return; }
                try {
                    const tx = photoDB.transaction(PHOTO_STORE_NAME, 'readonly');
                    const store = tx.objectStore(PHOTO_STORE_NAME);
                    const index = store.index('itemId');
                    const req = index.getAll(itemId);
                    req.onsuccess = () => {
                        const list = req.result || [];
                        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                        resolve(list);
                    };
                    req.onerror = () => resolve([]);
                } catch (e) {
                    resolve([]);
                }
            });
        }

        // 사진 1건 저장/수정
        function savePhotoRecord(record) {
            return new Promise((resolve) => {
                if (!photoDB) { resolve(false); return; }
                try {
                    const tx = photoDB.transaction(PHOTO_STORE_NAME, 'readwrite');
                    const store = tx.objectStore(PHOTO_STORE_NAME);
                    const req = store.put(record);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }

        // 모든 사진 레코드 가져오기
        function getAllPhotosFromDB() {
            return new Promise((resolve) => {
                if (!photoDB) { resolve([]); return; }
                try {
                    const tx = photoDB.transaction(PHOTO_STORE_NAME, 'readonly');
                    const store = tx.objectStore(PHOTO_STORE_NAME);
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                } catch (e) {
                    resolve([]);
                }
            });
        }

        // 구글 드라이브에서 사진 삭제 (휴지통 이동)
        async function deletePhotoFromDrive(driveFileId, fileName) {
            const webhookUrl = getDriveWebhookUrl();
            if (!webhookUrl || (!driveFileId && !fileName)) return false;

            try {
                // 1. GET 방식 호출 (CORS 리다이렉트 최적화)
                const url = new URL(webhookUrl);
                url.searchParams.set('action', 'delete');
                if (driveFileId) url.searchParams.set('fileId', driveFileId);
                if (fileName) url.searchParams.set('fileName', fileName);
                url.searchParams.set('t', Date.now());

                const res = await fetch(url.toString());
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success) return true;
                }
            } catch (err) {
                console.warn('Drive GET delete failed, trying POST:', err);
            }

            try {
                // 2. POST 방식 폴백
                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'delete',
                        fileId: driveFileId,
                        fileName: fileName
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    return data && data.success;
                }
            } catch (err2) {
                console.error('Drive POST delete failed:', err2);
            }
            return false;
        }

        // 사진 삭제
        function deletePhotoRecord(id) {
            return new Promise((resolve) => {
                if (!photoDB) { resolve(false); return; }
                try {
                    const tx = photoDB.transaction(PHOTO_STORE_NAME, 'readwrite');
                    const store = tx.objectStore(PHOTO_STORE_NAME);
                    const req = store.delete(id);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        }

        // 모든 사진 캐시 재구축
        function refreshPhotoCache() {
            return new Promise((resolve) => {
                if (!photoDB) { resolve(); return; }
                try {
                    const tx = photoDB.transaction(PHOTO_STORE_NAME, 'readonly');
                    const store = tx.objectStore(PHOTO_STORE_NAME);
                    const req = store.getAll();
                    req.onsuccess = () => {
                        const all = req.result || [];
                        const cache = {};
                        all.forEach(p => {
                            if (!cache[p.itemId]) {
                                cache[p.itemId] = { count: 0, pending: 0, latestThumb: p.dataUrl || p.thumbUrl || p.driveViewUrl, latestTime: p.createdAt };
                            }
                            cache[p.itemId].count += 1;
                            if (isPhotoPending(p)) cache[p.itemId].pending += 1;
                            if (new Date(p.createdAt) >= new Date(cache[p.itemId].latestTime)) {
                                cache[p.itemId].latestThumb = p.dataUrl || p.thumbUrl || p.driveViewUrl;
                                cache[p.itemId].latestTime = p.createdAt;
                            }
                        });
                        photoCache = cache;
                        resolve();
                    };
                    req.onerror = () => resolve();
                } catch (e) {
                    resolve();
                }
            });
        }

        // 구글 드라이브에서 최신 사진 목록을 가져와 로컬 DB 및 화면 동기화
        async function syncPhotosFromDrive() {
            const webhookUrl = getDriveWebhookUrl();
            if (!webhookUrl) return;

            try {
                const res = await fetch(`${webhookUrl}?action=getPhotos&t=${Date.now()}`);
                if (!res.ok) return;
                const result = await res.json();
                if (!result.success || !Array.isArray(result.photos)) return;

                let updated = false;
                for (const p of result.photos) {
                    let targetItemId = p.itemId;

                    // 파일명으로 체크리스트 항목 매칭
                    if (!targetItemId && p.fileName) {
                        const normFileName = p.fileName.replace(/[\s_]/g, '').toLowerCase();

                        // 1순위: [코드 + 작업내용] 매칭
                        let matched = SPREADSHEET_ITEMS.find(i => {
                            const normCodeAndText = (i.code + i.text).replace(/[\s_]/g, '').toLowerCase();
                            return normFileName.includes(normCodeAndText);
                        });

                        // 2순위: 작업내용 단독 매칭
                        if (!matched) {
                            matched = SPREADSHEET_ITEMS.find(i => {
                                const normText = i.text.replace(/[\s_]/g, '').toLowerCase();
                                return normText.length >= 2 && normFileName.includes(normText);
                            });
                        }

                        if (matched) {
                            targetItemId = matched.id;
                        }
                    }
                    if (!targetItemId) continue;

                    // 기존 DB 레코드 검색 및 갱신/신규 생성
                    const existing = await getPhotosByItemId(targetItemId);
                    const found = existing.find(item => item.id === p.id || item.driveFileId === p.id || item.fileName === p.fileName);

                    const record = {
                        id: found ? found.id : (p.id || ('photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6))),
                        itemId: targetItemId,
                        fileName: p.fileName,
                        dataUrl: (found && found.dataUrl && found.dataUrl.startsWith('data:')) ? found.dataUrl : (p.thumbUrl || p.driveUrl),
                        driveFileId: p.id,
                        driveViewUrl: p.driveUrl,
                        thumbUrl: p.thumbUrl,
                        createdAt: p.createdAt || (found ? found.createdAt : new Date().toISOString()),
                        synced: true,
                        isUploading: false
                    };

                    await savePhotoRecord(record);
                    updated = true;
                }

                // 구글 드라이브에서 삭제된 사진 로컬 DB 정리 (양방향 동기화)
                const drivePhotoIds = new Set(result.photos.map(p => p.id).filter(Boolean));
                const driveFileNames = new Set(result.photos.map(p => p.fileName).filter(Boolean));
                const allLocals = await getAllPhotosFromDB();
                for (const localP of allLocals) {
                    if (localP.synced && !localP.isUploading) {
                        const hasId = localP.driveFileId && drivePhotoIds.has(localP.driveFileId);
                        const hasName = localP.fileName && driveFileNames.has(localP.fileName);
                        if (!hasId && !hasName) {
                            await deletePhotoRecord(localP.id);
                            updated = true;
                        }
                    }
                }

                if (updated || result.photos.length > 0) {
                    await refreshPhotoCache();
                    renderChecklist();
                    if (currentPhotoItemId) {
                        await renderPhotoModalList();
                    }
                }
            } catch (err) {
                console.warn('Drive photo sync skipped:', err);
            }
        }

        // 이미지 압축 (최대 해상도 1600px, JPEG 0.82)
        function compressImage(file, maxWidth = 1600, quality = 0.82) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        let w = img.width;
                        let h = img.height;
                        if (w > maxWidth || h > maxWidth) {
                            if (w > h) {
                                h = Math.round((h * maxWidth) / w);
                                w = maxWidth;
                            } else {
                                w = Math.round((w * maxWidth) / h);
                                h = maxWidth;
                            }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(dataUrl);
                    };
                    img.onerror = () => reject(new Error('이미지 로드에 실패했습니다.'));
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
                reader.readAsDataURL(file);
            });
        }

        // 드라이브에 아직 올라가지 않은 기기 보관 사진인지
        function isPhotoPending(p) {
            return !p.synced && typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:');
        }

        // 업로드 상태(저장 중 → 완료/실패)를 DB와 화면에 반영하며 업로드
        async function uploadPhotoWithStatus(record) {
            record.isUploading = true;
            await savePhotoRecord(record);
            await renderPhotoModalList();
            const ok = await uploadPhotoToDrive(record);
            await refreshPhotoCache();
            await renderPhotoModalList();
            renderChecklist();
            return ok;
        }

        // 사진 모달의 [드라이브 저장] 버튼: 실패한 사진 다시 올리기
        async function retryUploadPhoto(photoId) {
            const all = await getAllPhotosFromDB();
            const record = all.find(p => p.id === photoId);
            if (!record) return;
            if (!getDriveWebhookUrl()) {
                showToast('드라이브가 연동되지 않았습니다. 설정에서 먼저 연결해 주세요.', 'ph-warning-circle');
                return;
            }
            showToast('드라이브에 다시 저장하는 중...', 'ph-spinner-gap spin');
            const ok = await uploadPhotoWithStatus(record);
            showToast(ok ? '구글 드라이브 저장 완료! ✨' : `드라이브 저장 실패: ${record.syncError || '오류'}`, ok ? 'ph-cloud-check' : 'ph-warning-circle');
        }

        // 기기에만 남아 있는 사진을 자동으로 다시 올림 (앱 시작·온라인 복귀·화면 복귀 시)
        let isRetryingUploads = false;
        async function retryPendingUploads() {
            if (isRetryingUploads || !getDriveWebhookUrl() || navigator.onLine === false) return;
            isRetryingUploads = true;
            try {
                // 업로드 도중 앱이 닫혀 '저장 중'으로 멈춘 사진도 다시 대상에 포함
                const pending = (await getAllPhotosFromDB()).filter(isPhotoPending);
                if (!pending.length) return;
                let okCount = 0;
                for (const record of pending) {
                    if (await uploadPhotoWithStatus(record)) okCount++;
                }
                const failCount = pending.length - okCount;
                if (okCount) showToast(`밀려 있던 사진 ${okCount}장을 드라이브에 저장했습니다.${failCount ? ` (${failCount}장 실패)` : ''}`, 'ph-cloud-check');
                else showToast(`사진 ${failCount}장이 아직 드라이브에 저장되지 않았습니다.`, 'ph-warning-circle');
            } finally {
                isRetryingUploads = false;
            }
        }

        window.addEventListener('online', () => retryPendingUploads());

        // 구글 드라이브 업로드
        async function uploadPhotoToDrive(photoRecord) {
            photoRecord.isUploading = false; // 아래에서 저장되는 최종 상태는 항상 '업로드 중 아님'
            const webhookUrl = getDriveWebhookUrl();
            if (!webhookUrl) {
                photoRecord.syncError = '웹 앱 URL 미설정';
                await savePhotoRecord(photoRecord);
                return false;
            }

            try {
                const payload = {
                    type: 'photo',
                    subFolder: '사진',
                    base64: photoRecord.dataUrl,
                    mimeType: 'image/jpeg',
                    fileName: photoRecord.fileName,
                    itemId: photoRecord.itemId
                };

                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                if (data.success) {
                    photoRecord.synced = true;
                    photoRecord.driveFileId = data.fileId;
                    photoRecord.driveViewUrl = data.viewUrl;
                    photoRecord.syncError = null;
                    await savePhotoRecord(photoRecord);
                    return true;
                } else {
                    photoRecord.syncError = data.error || '업로드 오류';
                    await savePhotoRecord(photoRecord);
                    return false;
                }
            } catch (err) {
                console.error('Drive photo upload failed:', err);
                photoRecord.syncError = err.message || '네트워크 오류';
                await savePhotoRecord(photoRecord);
                return false;
            }
        }

        // 사진 모달 열기
        async function openPhotoModal(itemId) {
            currentPhotoItemId = itemId;
            const item = SPREADSHEET_ITEMS.find(i => i.id === itemId);
            if (!item) return;

            document.getElementById('photoModalCat').textContent = `${item.code}. ${item.category}`;
            // 1번 작업 배지 삭제됨
            document.getElementById('photoItemText').textContent = item.text;

            updateDriveBannerStatus();
            await renderPhotoModalList();
            openSheet('photoModal');

            // 모달 열릴 때 구글 드라이브 최신 사진 즉시 동기화하여 PC 화면 실시간 반영
            syncPhotosFromDrive();
        }

        function closePhotoModal() {
            closeSheet('photoModal');
            currentPhotoItemId = null;
            renderChecklist();
        }

        function updateDriveBannerStatus() {
            const url = getDriveWebhookUrl();
            const bannerInfo = document.getElementById('driveBannerStatus');
            const bannerText = document.getElementById('driveBannerText');
            const driveIcon = document.getElementById('driveStatusIcon');
            const bottomDriveBtn = document.getElementById('bottomBtn-drive');

            if (url) {
                if (bannerInfo) bannerInfo.className = 'drive-status-info connected';
                if (bannerText) bannerText.textContent = '구글 드라이브 (\\예배부 데이터\\사진) 연동 중';
                if (driveIcon) driveIcon.style.color = '#10b981';
                if (bottomDriveBtn) {
                    bottomDriveBtn.style.color = '#059669';
                    bottomDriveBtn.title = '구글 드라이브 (\\예배부 데이터) 연동됨';
                }
            } else {
                if (bannerInfo) bannerInfo.className = 'drive-status-info disconnected';
                if (bannerText) bannerText.textContent = '구글 드라이브 미연동 (기기 로컬에 보관)';
                if (driveIcon) driveIcon.style.color = 'inherit';
                if (bottomDriveBtn) {
                    bottomDriveBtn.style.color = '';
                    bottomDriveBtn.title = '구글 드라이브 미연동 (클릭하여 설정)';
                }
            }
        }

        // 사진 모달 목록 렌더링
        async function renderPhotoModalList() {
            if (!currentPhotoItemId) return;
            const photos = await getPhotosByItemId(currentPhotoItemId);
            const container = document.getElementById('photoListContainer');
            document.getElementById('photoCountBadge').textContent = photos.length;

            if (photos.length === 0) {
                container.innerHTML = `
                    <div class="photo-empty-hint">
                        <i class="ph-bold ph-camera"></i>
                        아직 첨부된 사진이 없습니다.<br>
                        위의 [새 사진 찍기] 또는 [사진 첨부하기]를 눌러보세요!
                    </div>`;
                return;
            }

            container.innerHTML = photos.map(p => {
                const date = new Date(p.createdAt);
                const timeStr = `${date.getMonth() + 1}월 ${date.getDate()}일 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

                let statusHtml = '';
                if (p.synced && p.driveViewUrl) {
                    statusHtml = `<span class="photo-card-status synced"><i class="ph-bold ph-cloud-check"></i>\예배부 데이터\사진 저장됨</span>`;
                } else if (p.isUploading) {
                    statusHtml = `<span class="photo-card-status syncing"><i class="ph-bold ph-spinner-gap spin"></i>드라이브 저장 중...</span>`;
                } else {
                    statusHtml = `<span class="photo-card-status local"><i class="ph-bold ph-device-mobile"></i>기기 보관</span>`;
                }

                const driveActionBtn = (p.synced && p.driveViewUrl)
                    ? `<a class="photo-act-btn view-drive" href="${esc(p.driveViewUrl)}" target="_blank" rel="noopener noreferrer" title="구글 드라이브에서 열기"><i class="ph-bold ph-arrow-square-out"></i>드라이브</a>`
                    : '';

                return `
                    <div class="photo-card">
                        <div class="photo-card-img-wrap" onclick="openPhotoViewer('${p.id}')">
                            <img class="photo-card-img" src="${p.dataUrl || p.thumbUrl || p.driveViewUrl}" alt="첨부 사진" referrerpolicy="no-referrer" />
                        </div>
                        <div class="photo-card-body">
                            <span class="photo-card-time">${timeStr}</span>
                            ${statusHtml}
                            <div class="photo-card-actions">
                                <button class="photo-act-btn del" onclick="confirmDeletePhoto('${p.id}')"><i class="ph-bold ph-trash"></i>삭제</button>
                                ${(!p.synced && !p.isUploading) ? `<button class="photo-act-btn" style="color:var(--accent)" onclick="retryUploadPhoto('${p.id}')"><i class="ph-bold ph-cloud-arrow-up"></i>드라이브 저장</button>` : ''}
                                ${driveActionBtn}
                            </div>
                        </div>
                    </div>`;
            }).join('');
        }

        // 사진 촬영 및 선택 트리거
        function triggerCamera() {
            document.getElementById('cameraInput').click();
        }

        function triggerGallery() {
            document.getElementById('galleryInput').click();
        }

        // 파일 선택 처리
        async function handleFileSelected(files) {
            if (!files || !files.length || !currentPhotoItemId) return;

            const item = SPREADSHEET_ITEMS.find(i => i.id === currentPhotoItemId);
            const total = files.length;
            showToast(`${total}장의 사진을 준비 중입니다...`, 'ph-spinner-gap spin');

            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
            const srvName = SERVICE_NAMES[appState.currentService] || '예배';

            for (let i = 0; i < total; i++) {
                const file = files[i];
                try {
                    const compressedDataUrl = await compressImage(file, 1600, 0.82);
                    // 사용자 지정 규칙: 1_주보확인_날짜_시간_순번.jpg (공백 및 특수문자 제거)
                    const cleanItemText = (item ? item.text : '작업').replace(/[\s\/\:*?"<>|]/g, '');
                    const itemCode = (item && item.code) ? item.code : '1';
                    const fileName = `${itemCode}_${cleanItemText}_${dateStr}_${timeStr}_${i + 1}.jpg`;

                    const record = {
                        id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        itemId: currentPhotoItemId,
                        itemText: item ? item.text : '',
                        itemCode: item ? item.code : '',
                        service: appState.currentService,
                        date: dateStr,
                        fileName: fileName,
                        dataUrl: compressedDataUrl,
                        createdAt: new Date().toISOString(),
                        synced: false,
                        driveFileId: null,
                        driveViewUrl: null,
                        isUploading: false
                    };

                    await savePhotoRecord(record);
                    await refreshPhotoCache();
                    await renderPhotoModalList();
                    renderChecklist();

                    // 구글 드라이브 URL이 설정되어 있다면 즉시 비동기 업로드 진행
                    const webhookUrl = getDriveWebhookUrl();
                    if (webhookUrl) {
                        uploadPhotoWithStatus(record).then(success => {
                            if (success) {
                                showToast(`구글 드라이브 (\\예배부 데이터\\사진) 저장 완료! ✨`, 'ph-cloud-check');
                            } else {
                                showToast(`드라이브 저장 실패 – 기기에 보관 중이며, 연결되면 자동으로 다시 올립니다.`, 'ph-warning-circle');
                            }
                        });
                    } else {
                        showToast(`기기에 저장되었습니다 (드라이브 미연동).`, 'ph-device-mobile');
                    }
                } catch (e) {
                    console.error('Photo save error:', e);
                    showToast('사진 처리에 실패했습니다.', 'ph-warning-circle');
                }
            }

            // 파일 인풋 초기화
            document.getElementById('cameraInput').value = '';
            document.getElementById('galleryInput').value = '';
            buzz([15, 30]);
            showToast(`${total}장의 사진이 첨부되었습니다!`, 'ph-camera');
        }

        function confirmPhotoDelete() {
            return appConfirm({
                title: '사진 삭제',
                desc: '이 사진을 삭제할까요?\n구글 드라이브에서도 함께 삭제됩니다.',
                okText: '삭제',
                icon: 'ph-trash'
            });
        }

        // 사진 삭제 (체크리스트 사진 모달)
        async function confirmDeletePhoto(photoId) {
            if (!(await confirmPhotoDelete())) return;

            let target = null;
            if (currentPhotoItemId) {
                const photos = await getPhotosByItemId(currentPhotoItemId);
                target = photos.find(p => p.id === photoId);
            }
            if (!target) {
                const allPhotos = await getAllPhotosFromDB();
                target = allPhotos.find(p => p.id === photoId);
            }

            const driveFileId = target ? (target.driveFileId || target.id) : null;
            const fileName = target ? target.fileName : null;

            // 로컬 IndexedDB에서 삭제 및 화면 갱신
            await deletePhotoRecord(photoId);
            await refreshPhotoCache();
            await renderPhotoModalList();
            renderChecklist();

            // 구글 드라이브에서도 삭제 호출
            if (driveFileId || fileName) {
                showToast('구글 드라이브 삭제 중...', 'ph-spinner-gap spin');
                const ok = await deletePhotoFromDrive(driveFileId, fileName);
                if (ok) {
                    showToast('사진 및 구글 드라이브 삭제 완료', 'ph-trash');
                } else {
                    showToast('로컬 삭제 완료 (드라이브 확인 필요)', 'ph-trash');
                }
            } else {
                showToast('사진이 삭제되었습니다.', 'ph-trash');
            }
        }

        // 사진 삭제 (확대 뷰어 화면에서 현재 보는 사진 삭제)
        async function viewerDeleteCurrentPhoto() {
            if (!currentViewerPhotos.length) return;
            const target = currentViewerPhotos[currentViewerIndex];
            if (!target) return;
            if (!(await confirmPhotoDelete())) return;

            const photoId = target.id;
            const driveFileId = target.driveFileId || target.id;
            const fileName = target.fileName;

            // 로컬 IndexedDB에서 삭제
            await deletePhotoRecord(photoId);
            await refreshPhotoCache();
            renderChecklist();

            // 뷰어 리스트에서 제거 및 슬라이드 업데이트
            currentViewerPhotos.splice(currentViewerIndex, 1);
            if (currentViewerPhotos.length === 0) {
                closePhotoViewer();
            } else {
                if (currentViewerIndex >= currentViewerPhotos.length) {
                    currentViewerIndex = currentViewerPhotos.length - 1;
                }
                updateViewerDisplay();
            }

            if (currentPhotoItemId) {
                await renderPhotoModalList();
            }

            // 구글 드라이브 삭제
            if (driveFileId || fileName) {
                showToast('구글 드라이브 삭제 중...', 'ph-spinner-gap spin');
                const ok = await deletePhotoFromDrive(driveFileId, fileName);
                if (ok) {
                    showToast('사진 및 구글 드라이브 삭제 완료', 'ph-trash');
                } else {
                    showToast('로컬 삭제 완료 (드라이브 확인 필요)', 'ph-trash');
                }
            } else {
                showToast('사진이 삭제되었습니다.', 'ph-trash');
            }
        }

        // 사진 확대 뷰어 (이전/다음 슬라이드 지원)
        let currentViewerIndex = 0;
        let currentViewerPhotos = [];

        async function openPhotoViewer(photoId) {
            if (!currentPhotoItemId) return;
            currentViewerPhotos = await getPhotosByItemId(currentPhotoItemId);
            currentViewerIndex = currentViewerPhotos.findIndex(item => item.id === photoId);
            if (currentViewerIndex === -1) currentViewerIndex = 0;
            updateViewerDisplay();
            document.getElementById('photoViewerModal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }

        function updateViewerDisplay() {
            if (!currentViewerPhotos.length) return;
            const p = currentViewerPhotos[currentViewerIndex];
            document.getElementById('viewerImage').src = p.dataUrl || p.driveViewUrl || p.thumbUrl;
            document.getElementById('viewerTitle').textContent = `${p.fileName || '사진'} (${currentViewerIndex + 1}/${currentViewerPhotos.length})`;

            const prevBtn = document.getElementById('viewerPrevBtn');
            const nextBtn = document.getElementById('viewerNextBtn');
            const showNav = currentViewerPhotos.length > 1;
            if (prevBtn) prevBtn.style.display = showNav ? 'grid' : 'none';
            if (nextBtn) nextBtn.style.display = showNav ? 'grid' : 'none';

            const driveBtn = document.getElementById('viewerDriveBtn');
            if (p.synced && p.driveViewUrl) {
                driveBtn.href = p.driveViewUrl;
                driveBtn.classList.remove('hidden');
            } else {
                driveBtn.classList.add('hidden');
            }
        }

        function viewerPrevPhoto(e) {
            if (e) e.stopPropagation();
            if (currentViewerPhotos.length <= 1) return;
            currentViewerIndex = (currentViewerIndex - 1 + currentViewerPhotos.length) % currentViewerPhotos.length;
            updateViewerDisplay();
        }

        function viewerNextPhoto(e) {
            if (e) e.stopPropagation();
            if (currentViewerPhotos.length <= 1) return;
            currentViewerIndex = (currentViewerIndex + 1) % currentViewerPhotos.length;
            updateViewerDisplay();
        }

        // 모바일 사진 뷰어 좌우 터치 스와이프 제스처
        let viewerTouchStartX = 0;
        let viewerTouchStartY = 0;
        const viewerModalEl = document.getElementById('photoViewerModal');
        if (viewerModalEl) {
            viewerModalEl.addEventListener('touchstart', e => {
                if (e.changedTouches && e.changedTouches.length > 0) {
                    viewerTouchStartX = e.changedTouches[0].clientX;
                    viewerTouchStartY = e.changedTouches[0].clientY;
                }
            }, { passive: true });

            viewerModalEl.addEventListener('touchend', e => {
                if (!e.changedTouches || e.changedTouches.length === 0) return;
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const diffX = endX - viewerTouchStartX;
                const diffY = endY - viewerTouchStartY;

                // 좌우 스와이프 (수평 이동량이 40px 이상이고 수직 이동량보다 클 때)
                if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
                    if (diffX < 0) {
                        viewerNextPhoto();
                    } else {
                        viewerPrevPhoto();
                    }
                }
            }, { passive: true });
        }

        function closePhotoViewer() {
            document.getElementById('photoViewerModal').classList.add('hidden');
            if (!document.querySelector('.backdrop:not(.hidden)')) {
                document.body.style.overflow = '';
            }
        }

        // 스크롤 감지 및 맨 위로 스크롤
        window.addEventListener('scroll', () => {
            const topBtn = document.getElementById('scrollTopBtn');
            if (!topBtn) return;
            if (window.scrollY > 260) {
                topBtn.classList.add('visible');
            } else {
                topBtn.classList.remove('visible');
            }
        }, { passive: true });

        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // 구글 드라이브 설정 모달
        function openDriveConfigModal() {
            document.getElementById('driveWebhookInput').value = getDriveWebhookUrl();
            openSheet('driveConfigModal');
        }

        function closeDriveConfigModal() {
            closeSheet('driveConfigModal');
            updateDriveBannerStatus();
            refreshSettingsStatus();
            if (!document.getElementById('attendanceModal').classList.contains('hidden')) renderAttendanceModal();
        }

        function saveDriveWebhookUrl() {
            const val = document.getElementById('driveWebhookInput').value.trim();
            // 빈 값이거나 기본 URL과 같으면 저장값을 지워 내장 기본 URL을 따르게 함
            if (!val || val === DEFAULT_DRIVE_WEBHOOK_URL) localStorage.removeItem(DRIVE_WEBHOOK_KEY);
            else localStorage.setItem(DRIVE_WEBHOOK_KEY, val);
            updateDriveBannerStatus();
            showToast(val ? '구글 드라이브 설정이 저장되었습니다!' : '기본 드라이브 설정으로 되돌렸습니다.', 'ph-check-circle');
            closeDriveConfigModal();
        }

        async function testDriveConnection() {
            const val = document.getElementById('driveWebhookInput').value.trim();
            if (!val) {
                showToast('웹 앱 URL을 입력해 주세요.', 'ph-warning-circle');
                return;
            }
            showToast('드라이브 연결 테스트 중...', 'ph-spinner-gap spin');
            try {
                const res = await fetch(val + (val.includes('?') ? '&' : '?') + 'test=1');
                const data = await res.json();
                if (data.status === 'ok') {
                    showToast('성공! 구글 드라이브 (\예배부 데이터) 연동 완료', 'ph-check-circle');
                } else {
                    showToast('연결 성공 (응답 확인 완료)', 'ph-check-circle');
                }
            } catch (err) {
                showToast('연결 확인: URL 및 배포 권한(모든 사용자)을 점검하세요.', 'ph-warning-circle');
            }
        }

        function copyGasCode() {
            const code = document.getElementById('gasScriptCode').textContent;
            let ok = false;
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(code);
                    ok = true;
                }
            } catch (e) { }
            if (!ok) ok = legacyCopy(code);
            showToast(ok ? 'Apps Script 코드가 복사되었습니다!' : '복사에 실패했습니다.', ok ? 'ph-copy' : 'ph-warning-circle');
        }

