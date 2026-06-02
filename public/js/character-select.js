/* ── Phase C v3: 학습자 연기 캐릭터 선택 ── */
const ROLE_CLASS  = { '상위리더': 'role-executive', '그룹장': 'role-manager', '파트장': 'role-lead', '부서원': 'role-member' };
const ROLE_COLORS = { 'role-executive': '#312E2B', 'role-manager': '#1B3250', 'role-lead': '#1A3D30', 'role-member': '#6B3B1D' };

/* 시나리오별 히어로 인포그래픽 메타 (배경 톤·갈등 구조·헤드라인) */
const SCENE_META = {
  1: { tone: 'office-conflict',    conflict: 'AI 도입 압박', vs: '팀원 저항',       headline: 'AI혁신센터, 경영진 압박과 현장이 충돌하다',         org: '6인 조직 · 3계층' },
  2: { tone: 'deadline-pressure',  conflict: 'KPI D-14 압박', vs: '현장 번아웃',     headline: 'AI 성과 보고 D-14, 조직 번아웃 임계점',             org: '6인 조직 · 3계층' },
  4: { tone: 'crisis-cdp',         conflict: 'CDP 전환 D-30', vs: '치명적 오류 발견', headline: '147억 투자 CDP, D-30에 치명적 오류가 발견됐다',    org: '6인 조직 · 4계층' },
};

const params     = new URLSearchParams(location.search);
const scenarioId = params.get('scenario_id') || '1';

let allChars = [];

/* ── 히어로 인포그래픽 주입 ── */
function injectSceneHero(sid) {
  const hero = document.getElementById('sceneHero');
  if (!hero) return;
  const id   = parseInt(sid, 10);
  const meta = SCENE_META[id];
  if (!meta) { hero.classList.add('hidden'); return; }

  hero.classList.remove('hidden');
  hero.classList.add(`scene-${meta.tone}`);

  hero.innerHTML = `
    <div class="hero-inner">
      <div class="hero-org" aria-label="조직 구성">${esc(meta.org)}</div>
      <h2 class="hero-main-title">${esc(meta.headline)}</h2>
      <div class="hero-conflict" role="img" aria-label="핵심 갈등 구조: ${esc(meta.conflict)} 대 ${esc(meta.vs)}">
        <div class="conflict-node--a">${esc(meta.conflict)}</div>
        <div class="conflict-arrow" aria-hidden="true">↔</div>
        <div class="conflict-node--b">${esc(meta.vs)}</div>
      </div>
    </div>
    <div class="hero-prompt-bar">
      <span class="hero-prompt-text">이 상황에서 누구를 연기하시겠습니까?</span>
      <div class="hero-prompt-divider" aria-hidden="true"></div>
    </div>`;
}

/* ── 초기화 ── */
async function initPage() {
  injectSceneHero(scenarioId);
  await Promise.all([loadScenarioInfo(), loadCharacters()]);
  document.getElementById('loadingState')?.remove();
  bindCardEvents();
  bindModalEvents();
}

async function loadScenarioInfo() {
  try {
    const res = await fetch(`/api/scenarios/${scenarioId}`);
    const s   = await res.json();
    const label = document.getElementById('scenarioLabel');
    if (label) label.textContent = s.case_name || s.title || '';
    const briefEl   = document.getElementById('learnerBrief');
    const missionEl = document.getElementById('learnerMission');
    if (briefEl)   briefEl.textContent   = s.context_description?.slice(0, 120) + (s.context_description?.length > 120 ? '...' : '') || '—';
    if (missionEl) missionEl.textContent = s.learner_mission || '캐릭터를 선택하고 그 역할로 대화를 시작하세요.';
  } catch {
    const label = document.getElementById('scenarioLabel');
    if (label) label.textContent = 'Case Study';
  }
}

async function loadCharacters() {
  const grid = document.getElementById('cardGrid');
  try {
    const res  = await fetch(`/api/scenarios/${scenarioId}/characters`);
    allChars   = await res.json();
    if (!allChars.length) {
      grid.innerHTML = '<p class="empty-state grid-span-full">등록된 캐릭터가 없습니다.</p>';
      return;
    }
    grid.innerHTML = allChars
      .sort((a, b) => a.card_number - b.card_number)
      .map((c, i) => buildCardHTML(c, i))
      .join('');
    document.dispatchEvent(new Event('charactersLoaded'));
  } catch {
    grid.innerHTML = '<p class="empty-state grid-span-full">캐릭터 정보를 불러올 수 없습니다.</p>';
  }
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── 카드 HTML (v3: 모든 캐릭터 선택 가능 + 연기용 간소 표시) ── */
function buildCardHTML(c, idx) {
  const roleClass = ROLE_CLASS[c.role_level] || 'role-member';
  const emoji     = c.emoji || getDefaultEmoji(c.role_level);
  const num       = String(c.card_number).padStart(2, '0');

  // 연기용 가치관 1줄 (learner_detail.values 또는 core_mindset)
  const valueStr = c.learner_detail?.values || c.core_mindset || '';
  const valueShort = valueStr.slice(0, 45) + (valueStr.length > 45 ? '...' : '');

  // 상황 1줄
  const sitStr = c.situation || '';
  const sitShort = sitStr.slice(0, 50) + (sitStr.length > 50 ? '...' : '');

  return `
  <div class="char-card ${roleClass} selectable"
       data-char-id="${c.id}" data-number="${num}"
       data-name="${esc(c.name)}" data-emoji="${emoji}"
       data-role="${esc(c.role_level)}"
       tabindex="0" role="button"
       aria-label="${esc(c.name)} — 클릭해서 이 역할 맡기">
    <div class="card-accent-bar"></div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-emoji">${emoji}</span>
        <span class="role-badge">${esc(c.role_level)}</span>
        <span class="card-number">NO. ${num}</span>
      </div>
      <div class="card-identity">
        <p class="char-name">${esc(c.name)}</p>
        <p class="char-dept">${esc(c.department)}</p>
      </div>
      <p class="card-mindset-short">"${esc(valueShort)}"</p>
      <p class="card-situation-short">${esc(sitShort)}</p>
      <p class="card-hint">클릭해서 자세히 보기 →</p>
    </div>
  </div>`;
}

function getDefaultEmoji(roleLevel) {
  const map = { '상위리더': '👔', '그룹장': '📊', '파트장': '⚡', '부서원': '💼' };
  return map[roleLevel] || '👤';
}

/* ── 이벤트 바인딩 ── */
function bindCardEvents() {
  document.querySelectorAll('.char-card.selectable').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.charId));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(card.dataset.charId); });
  });
}

/* ── 모달 오픈 ── */
function openModal(charId) {
  const c = allChars.find(ch => String(ch.id) === String(charId));
  if (!c) return;

  const roleClass = ROLE_CLASS[c.role_level] || 'role-member';
  const color     = ROLE_COLORS[roleClass] || '#1A3D30';
  const emoji     = c.emoji || getDefaultEmoji(c.role_level);
  const ld        = c.learner_detail || {};

  const leftPanel = document.getElementById('modalAccentBar');
  leftPanel.style.background = '';
  leftPanel.style.borderTopColor = color;

  const badge = document.getElementById('modalRoleBadge');
  badge.textContent = c.role_level;
  badge.className = `role-badge ${roleClass}`;

  document.getElementById('modalName').textContent = `${emoji} ${c.name}`;
  document.getElementById('modalDept').textContent  = c.department || '';

  const mindsetEl = document.getElementById('modalMindset');
  mindsetEl.textContent = c.core_mindset || '';
  mindsetEl.style.borderLeftColor = color;

  // 연기용 detail — 구조화 렌더
  setTxt('modalBackground', ld.background || c.situation);
  renderQuoteBox('modalValues', ld.values || c.core_mindset);
  renderIconRows('modalPressure', ld.pressures || ld.inner_conflict || c.situation, 'alert');
  renderIconRows('modalMission', ld.mission || c.mission, 'check');
  renderSpeechBoxes('modalSpeechStyle', ld.speech_style || ld.speaking_style);
  renderRelations('modalRelationships', ld.relationships_structured, ld.relationships, c.name, c.role_level);
  renderEmotionTimeline('modalEmotionalStates', ld.emotional_states);

  // 첫 발화 힌트 (3 → 5개로 확장)
  const hints  = ld.ai_hints?.first_utterances || c.first_utterances || [];
  const hintEl = document.getElementById('modalHints');
  const hintWrap = document.getElementById('modalHintWrap');
  if (hints.length > 0) {
    hintEl.innerHTML = hints.slice(0, 5).map(h => `<div class="modal-hint-item">${esc(h)}</div>`).join('');
    hintWrap.classList.remove('hidden');
  } else {
    hintWrap.classList.add('hidden');
  }

  // CTA 버튼 (B안: 항상 블랙·CSS에서 관리)
  const selectBtn = document.getElementById('modalSelectBtn');
  selectBtn.dataset.charId = charId;

  // 탭 첫 번째(프로필)로 초기화
  resetModalTabs();
  document.getElementById('charModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/* ── 모달 이벤트 ── */
function bindModalEvents() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('charModalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('charModalOverlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.getElementById('modalSelectBtn').addEventListener('click', () => {
    const charId = document.getElementById('modalSelectBtn').dataset.charId;
    selectLearnerChar(charId);
  });

  // 탭 전환
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.modal-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === target);
        t.setAttribute('aria-selected', t.dataset.tab === target ? 'true' : 'false');
      });
      document.querySelectorAll('.modal-tab-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.panel === target);
      });
    });
  });
}

/* ── 탭 초기화 (모달 열릴 때) ── */
function resetModalTabs() {
  document.querySelectorAll('.modal-tab').forEach((t, i) => {
    t.classList.toggle('active', i === 0);
    t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
  });
  document.querySelectorAll('.modal-tab-panel').forEach((p, i) => {
    p.classList.toggle('active', i === 0);
  });
}

function closeModal() {
  document.getElementById('charModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ── 연기 캐릭터 선택 → Step 2 이동 ── */
function selectLearnerChar(charId) {
  const c = allChars.find(ch => String(ch.id) === String(charId));
  if (!c) return;
  // URL: partner-select.html?scenario_id=4&learner_char=15
  window.location.href = `partner-select.html?scenario_id=${scenarioId}&learner_char=${charId}`;
}

/* ── 구조화 렌더 헬퍼 ── */
const ICON_ALERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

function setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '—';
}

function renderQuoteBox(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (!text) { el.textContent = '—'; return; }
  const box = document.createElement('div');
  box.className = 'modal-quote-box';
  box.textContent = text;
  el.appendChild(box);
}

function renderSpeechBoxes(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (!text) { el.textContent = '—'; return; }
  text.split('\n').filter(s => s.trim()).forEach(line => {
    const box = document.createElement('div');
    box.className = 'modal-speech-box';
    box.textContent = line.trim();
    el.appendChild(box);
  });
  if (!el.firstChild) el.textContent = '—';
}

function renderIconRows(id, text, iconType) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (!text) { el.textContent = '—'; return; }
  const row = document.createElement('div');
  row.className = 'modal-icon-row';
  const icon = document.createElement('span');
  icon.className = 'modal-icon';
  icon.innerHTML = iconType === 'alert' ? ICON_ALERT : ICON_CHECK;
  const txt = document.createElement('span');
  txt.className = 'modal-icon-text';
  txt.textContent = text;
  row.appendChild(icon);
  row.appendChild(txt);
  el.appendChild(row);
}

function getLineStyle(type) {
  if (!type) return { stroke: '#A1A1AA', sw: 1.5, dash: '5,3' };
  const t = type.trim();
  if (/상사|경영진|본부장|CCO/.test(t))   return { stroke: '#09090B', sw: 2,   dash: '' };
  if (/동료|그룹장|파트장/.test(t))         return { stroke: '#52525B', sw: 1.5, dash: '' };
  if (/부하|후배|CL|팀원/.test(t))          return { stroke: '#A1A1AA', sw: 1.5, dash: '4,3' };
  return { stroke: '#A1A1AA', sw: 1.5, dash: '5,3' };
}

function getRoleAvatar(roleLevel) {
  const map = { '상위리더': 'exec', '그룹장': 'mgr', '파트장': 'lead', '부서원': 'member' };
  return map[roleLevel] || 'lead';
}

function getRelCategory(type) {
  if (!type) return 'other';
  if (/상사|경영진|본부장/.test(type)) return 'superior';
  if (/동료|선배/.test(type)) return 'peer';
  if (/부하|후배|간접/.test(type)) return 'subordinate';
  return 'other';
}

function renderRelations(id, structured, fallback, lName, lRoleLevel) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';

  if (!Array.isArray(structured) || structured.length === 0) {
    el.textContent = (typeof fallback === 'string' && fallback) ? fallback : '—';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'rel-infographic';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `${lName || '캐릭터'} 관계 인포그래픽`);

  // ① 중앙 캐릭터 카드
  const centerCard = document.createElement('div');
  centerCard.className = 'rel-center-card';

  const cAv = document.createElement('div');
  cAv.className = `rel-avatar rel-avatar--lg ${getRoleAvatar(lRoleLevel)}`;
  cAv.setAttribute('aria-hidden', 'true');

  const cInfo = document.createElement('div');
  cInfo.className = 'rel-center-info';
  const cName = document.createElement('p');
  cName.className = 'rel-cname';
  cName.textContent = lName || '—';
  const cRole = document.createElement('span');
  cRole.className = 'rel-crole';
  cRole.textContent = lRoleLevel || '';
  cInfo.appendChild(cName);
  cInfo.appendChild(cRole);
  centerCard.appendChild(cAv);
  centerCard.appendChild(cInfo);
  wrap.appendChild(centerCard);

  // ② 섹션별 분류
  const CATS = {
    superior:    { label: '직속 보고 상사', cls: 'superior', items: [] },
    peer:        { label: '주요 동료',       cls: 'peer',     items: [] },
    subordinate: { label: '팀원 · 후배',     cls: 'sub',      items: [] },
    other:       { label: '주요 관계',       cls: 'other',    items: [] },
  };

  structured.forEach(r => {
    const found = allChars.find(ch => ch.name === r.target_name);
    CATS[getRelCategory(r.type)].items.push({ ...r, found });
  });

  Object.values(CATS).forEach(cat => {
    if (!cat.items.length) return;

    const section = document.createElement('div');
    section.className = `rel-section rel-section--${cat.cls}`;

    const hdr = document.createElement('div');
    hdr.className = 'rel-section-hdr';
    const icon = document.createElement('span');
    icon.className = `rel-cat-icon rel-cat-icon--${cat.cls}`;
    icon.setAttribute('aria-hidden', 'true');
    const lbl = document.createElement('span');
    lbl.className = 'rel-section-lbl';
    lbl.textContent = cat.label;
    hdr.appendChild(icon);
    hdr.appendChild(lbl);
    section.appendChild(hdr);

    const cards = document.createElement('div');
    cards.className = 'rel-mini-cards';

    cat.items.forEach(r => {
      const card = document.createElement('div');
      card.className = 'rel-mini-card';

      const av = document.createElement('div');
      av.className = `rel-avatar ${getRoleAvatar(r.found?.role_level)}`;
      av.setAttribute('aria-hidden', 'true');

      const info = document.createElement('div');
      info.className = 'rel-mini-info';

      const nm = document.createElement('p');
      nm.className = 'rel-mini-name';
      nm.textContent = r.target_name || '—';
      info.appendChild(nm);

      if (r.description) {
        const desc = document.createElement('p');
        desc.className = 'rel-mini-desc';
        desc.textContent = r.description;
        info.appendChild(desc);
      }

      if (r.type) {
        const tp = document.createElement('span');
        tp.className = 'rel-mini-type';
        tp.textContent = r.type;
        info.appendChild(tp);
      }

      card.appendChild(av);
      card.appendChild(info);
      cards.appendChild(card);
    });

    section.appendChild(cards);
    wrap.appendChild(section);
  });

  el.appendChild(wrap);
}

function renderEmotionTimeline(id, states) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (!Array.isArray(states) || states.length === 0) { el.textContent = '—'; return; }
  const tl = document.createElement('div');
  tl.className = 'emotion-timeline';
  states.forEach((s, i) => {
    const step = document.createElement('div');
    step.className = 'emotion-step';
    const stage = document.createElement('div');
    stage.className = 'emotion-stage-name';
    stage.textContent = s.stage || '';
    const trigger = document.createElement('div');
    trigger.className = 'emotion-trigger';
    trigger.textContent = s.trigger || '';
    const ex = document.createElement('div');
    ex.className = 'emotion-example';
    ex.textContent = s.example ? `"${s.example}"` : '';
    step.appendChild(stage);
    step.appendChild(trigger);
    step.appendChild(ex);
    tl.appendChild(step);
    if (i < states.length - 1) {
      const arr = document.createElement('div');
      arr.className = 'emotion-arrow';
      arr.setAttribute('aria-hidden', 'true');
      arr.textContent = '→';
      tl.appendChild(arr);
    }
  });
  el.appendChild(tl);
}

initPage();
