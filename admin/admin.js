// jskim.art Admin
(function () {
  const CFG = window.JSKIM_CONFIG;
  const $ = (id) => document.getElementById(id);

  const helperStatusText = $('helper-status-text');
  const fId = $('f-id'), fSection = $('f-section'), fCaptionType = $('f-caption-type');
  const fYear = $('f-year'), fStatus = $('f-status');
  const fTitleKr = $('f-title-kr'), fTitleEn = $('f-title-en');
  const fMaterialKr = $('f-material-kr'), fMaterialEn = $('f-material-en');
  const fSizeKr = $('f-size-kr'), fSizeEn = $('f-size-en');
  const fImage = $('f-image');
  const idWarning = $('id-warning'), filenameWarning = $('filename-warning');
  const preview = $('preview');
  const btnCheck = $('btn-check'), btnSubmit = $('btn-submit'), btnPush = $('btn-push');
  const reviewBox = $('review-box'), logBox = $('log-box');

  let sections = [];
  let works = [];
  let helperOnline = false;
  let lastProcessedImage = null; // { imagePath, zoomPath } returned by helper
  let checkPassed = false;

  function log(msg, cls) {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  async function api(path, options) {
    const res = await fetch(CFG.helperUrl + path, options);
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text || res.statusText);
    }
    return res.json();
  }

  async function checkHelper() {
    try {
      await api('/api/health');
      helperOnline = true;
      helperStatusText.textContent = '연결됨 (로컬 helper 실행 중)';
      helperStatusText.className = 'ok';
    } catch (e) {
      helperOnline = false;
      helperStatusText.textContent = '연결 안 됨 — local-helper/server.py 를 먼저 실행하세요';
      helperStatusText.className = 'fail';
    }
  }

  async function loadData() {
    try {
      sections = helperOnline ? await api('/api/sections') : [];
      works = helperOnline ? await api('/api/works') : [];
    } catch (e) {
      sections = []; works = [];
      log('데이터 로드 실패: ' + e.message, 'err');
    }
    populateSections();
  }

  function populateSections() {
    fSection.innerHTML = '';
    sections.filter(s => s.active).sort((a, b) => a.order - b.order).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.key;
      opt.textContent = s.title_kr + ' / ' + s.title_en;
      fSection.appendChild(opt);
    });
  }

  function populateStaticSelects() {
    CFG.statusOptions.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.kr + ' / ' + o.en;
      fStatus.appendChild(opt);
    });
    CFG.captionTypeOptions.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.kr + ' / ' + o.en;
      fCaptionType.appendChild(opt);
    });
  }

  fId.addEventListener('input', () => {
    const id = fId.value.trim();
    const dup = works.some(w => w.id === id);
    idWarning.textContent = dup ? '⚠ 이미 사용 중인 작품 ID입니다.' : '';
    resetSubmitState();
  });

  fImage.addEventListener('change', () => {
    preview.innerHTML = '';
    const file = fImage.files[0];
    if (!file) return;
    const dupName = works.some(w => w.image && w.image.endsWith('/' + file.name));
    filenameWarning.textContent = dupName ? '⚠ 동일한 파일명이 이미 등록되어 있습니다.' : '';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
    resetSubmitState();
  });

  function resetSubmitState() {
    checkPassed = false;
    btnSubmit.disabled = true;
    btnPush.disabled = true;
    lastProcessedImage = null;
  }

  function buildWorkObject() {
    const section = sections.find(s => s.key === fSection.value) || {};
    return {
      id: fId.value.trim(),
      section_id: section.id,
      section_key: section.key,
      section_kr: section.title_kr,
      section_en: section.title_en,
      title_kr: fTitleKr.value.trim(),
      title_en: fTitleEn.value.trim(),
      material_kr: fMaterialKr.value.trim(),
      material_en: fMaterialEn.value.trim(),
      size_kr: fSizeKr.value.trim(),
      size_en: fSizeEn.value.trim(),
      year: fYear.value.trim(),
      caption_type: fCaptionType.value,
      status: fStatus.value,
      image: null, // filled in after image processing
      zoom: null
    };
  }

  function validate() {
    const errors = [];
    if (!fId.value.trim()) errors.push('작품 ID를 입력하세요.');
    if (works.some(w => w.id === fId.value.trim())) errors.push('작품 ID가 중복됩니다.');
    if (!fSection.value) errors.push('섹션을 선택하세요.');
    if (!fCaptionType.value) errors.push('캡션 유형을 선택하세요.');
    if (!fYear.value.trim()) errors.push('제작연도를 입력하세요.');
    if (!fStatus.value) errors.push('상태를 선택하세요.');
    if (!fImage.files[0]) errors.push('이미지 파일을 선택하세요.');
    if (!fTitleKr.value.trim() && !fTitleEn.value.trim()) errors.push('제목은 KR 또는 EN 중 최소 한 언어에 입력하세요.');
    return errors;
  }

  btnCheck.addEventListener('click', () => {
    const errors = validate();
    if (errors.length) {
      reviewBox.textContent = '다음 항목을 확인하세요:\n- ' + errors.join('\n- ');
      checkPassed = false;
      btnSubmit.disabled = true;
      return;
    }
    const w = buildWorkObject();
    reviewBox.textContent =
      'KR\n' +
      '  제목: ' + (w.title_kr || '(비어있음)') + '\n' +
      '  재료: ' + (w.material_kr || '(비어있음)') + '\n' +
      '  크기: ' + (w.size_kr || '(비어있음)') + '\n\n' +
      'EN\n' +
      '  Title: ' + (w.title_en || '(empty)') + '\n' +
      '  Material: ' + (w.material_en || '(empty)') + '\n' +
      '  Size: ' + (w.size_en || '(empty)') + '\n\n' +
      '공통\n' +
      '  섹션: ' + w.section_kr + ' / ' + w.section_en + '\n' +
      '  연도: ' + w.year + '   상태: ' + w.status + '   캡션유형: ' + w.caption_type;
    checkPassed = true;
    btnSubmit.disabled = !helperOnline;
    if (!helperOnline) log('로컬 helper가 실행 중이 아니어서 저장을 진행할 수 없습니다.', 'err');
  });

  btnSubmit.addEventListener('click', async () => {
    if (!checkPassed) return;
    btnSubmit.disabled = true;
    try {
      log('이미지 처리 시작…');
      const formData = new FormData();
      formData.append('id', fId.value.trim());
      formData.append('caption_type', fCaptionType.value);
      formData.append('image', fImage.files[0]);
      const imgResult = await fetch(CFG.helperUrl + '/api/process-image', { method: 'POST', body: formData })
        .then(r => { if (!r.ok) return r.text().then(t => { throw new Error(t); }); return r.json(); });
      lastProcessedImage = imgResult;
      log('이미지 처리 완료: standard=' + imgResult.imagePath + ', zoom=' + imgResult.zoomPath, 'ok');

      const work = buildWorkObject();
      work.image = CFG.imageBase + '/' + imgResult.imagePath;
      work.zoom = CFG.imageBase + '/' + imgResult.zoomPath;

      log('works.json 저장 중…');
      await api('/api/save-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(work)
      });
      log('works.json 저장 완료 (백업 생성됨).', 'ok');
      works.push(work);
      btnPush.disabled = false;
    } catch (e) {
      log('오류 발생: ' + e.message + ' — 변경사항 없음(원상복구됨).', 'err');
      btnSubmit.disabled = false;
    }
  });

  btnPush.addEventListener('click', async () => {
    btnPush.disabled = true;
    try {
      log('GitHub push 중…');
      await api('/api/git-commit-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'add work ' + fId.value.trim() })
      });
      log('GitHub push 완료. jskim.art 반영까지 몇 분 소요될 수 있습니다.', 'ok');
    } catch (e) {
      log('push 실패: ' + e.message, 'err');
      btnPush.disabled = false;
    }
  });

  (async function init() {
    populateStaticSelects();
    await checkHelper();
    await loadData();
  })();
})();
