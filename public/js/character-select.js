const ROLE_CLASS  = { '상위리더': 'role-executive', '그룹장': 'role-manager', '파트장': 'role-lead', '부서원': 'role-member' };
const ROLE_EMOJI  = { '상위리더': '👔', '그룹장': '📊', '파트장': '⚡', '부서원': '💼' };
const ROLE_COLORS = { 'role-executive': '#312e81', 'role-manager': '#1e3a8a', 'role-lead': '#134e4a', 'role-member': '#78350f' };

const params     = new URLSearchParams(location.search);
const scenarioId = params.get('scenario_id') || '1';

let selectedCard = null;
let selectedData = {};
let allChars     = [];

/* ── 페이지 초기화 ── */
async function initPage() {
  await Promise.all([loadScenarioInfo(), loadCharacters()]);
  document.getElementById('loadingState')?.remove();
  bindCardEvents();
  bindModalEvents();
}

/* ── 시나리오 정보 로드 (학습자 브리핑 포함) ── */
async function loadScenarioInfo() {
  try {
    const res = await fetch(`/api/scenarios/${scenarioId}`);
    const s   = await res.json();
    const label = document.getElementById('scenarioLabel');
    if (label) label.textContent = s.case_name || s.title || '';

    // 학습자 브리핑 카드
    const roleEl     = document.getElementById('learnerRole');
    const briefEl    = document.getElementById('learnerBrief');
    const missionEl  = document.getElementById('learnerMission');
    if (roleEl)    roleEl.textContent    = s.learner_role || '—';
    if (briefEl)   briefEl.textContent   = s.learner_brief || s.context_description?.slice(0, 80) + '...' || '—';
    if (missionEl) missionEl.textContent = s.learner_mission || '시나리오를 선택하고 대화를 시작하세요.';
  } catch {
    const label = document.getElementById('scenarioLabel');
    if (label) label.textContent = 'Case Study';
  }
}

/* ── 캐릭터 로드 ── */
async function loadCharacters() {
  const grid = document.getElementById('cardGrid');
  try {
    const res    = await fetch(`/api/scenarios/${scenarioId}/characters`);
    allChars     = await res.json();
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
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 간소화된 카드 HTML (이모지 + 이름 + 상황 1줄) ── */
function buildCardHTML(c, idx) {
  const roleClass  = ROLE_CLASS[c.role_level] || 'role-member';
  const emoji      = ROLE_EMOJI[c.role_level] || '👤';
  const num        = String(c.card_number).padStart(2, '0');
  const selectable = c.is_selectable;
  const ctxOverlay = !selectable ? '<div class="context-overlay">컨텍스트</div>' : '';

  // 상황 1줄 요약 (앞 50자)
  const sitSummary = (c.situation || '').slice(0, 50) + ((c.situation || '').length > 50 ? '...' : '');

  return `
  <div class="char-card ${roleClass}${selectable ? ' selectable' : ' context-only'}"
       data-role="${esc(c.role_level)}" data-selectable="${selectable ? 'true' : 'false'}"
       data-number="${num}" data-name="${esc(c.name)}" data-emoji="${emoji}"
       data-char-id="${c.id}"
       tabindex="${selectable ? '0' : '-1'}"
       role="${selectable ? 'button' : 'presentation'}"
       aria-label="${esc(c.name)} — 클릭해서 상세 정보 보기">
    <div class="card-accent-bar"></div>
    ${ctxOverlay}
    <div class="card-body">
      <!-- 이모지 + 역할 뱃지 -->
      <div class="card-meta">
        <span class="card-emoji">${emoji}</span>
        <span class="role-badge">${esc(c.role_level)}</span>
        <span class="card-number">NO. ${num}</span>
      </div>
      <!-- 이름 + 직책 -->
      <div class="card-identity">
        <p class="char-name">${esc(c.name)}</p>
        <p class="char-dept">${esc(c.department)}</p>
      </div>
      <!-- 핵심 마인드 1줄 -->
      <p class="card-mindset-short">"${esc(c.core_mindset?.slice(0, 40))}${(c.core_mindset?.length||0) > 40 ? '...' : ''}"</p>
      <!-- 상황 요약 1줄 -->
      <p class="card-situation-short">${esc(sitSummary)}</p>
      <!-- 클릭 힌트 -->
      <p class="card-hint">클릭해서 자세히 보기 →</p>
    </div>
  </div>`;
}

/* ── 카드 이벤트 바인딩 ── */
function bindCardEvents() {
  document.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.charId));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(card.dataset.charId); });
  });

  document.querySelectorAll('.cta-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.location.href = `chat.html?scenario_id=${scenarioId}&character=${btn.dataset.charNumber}`;
    });
  });
}

document.getElementById('startBtn').addEventListener('click', goToChat);

/* ── 카드 선택 (선택 가능 카드만) ── */
function selectCardById(charId) {
  const card = document.querySelector(`[data-char-id="${charId}"]`);
  if (!card || !card.classList.contains('selectable')) return;

  if (selectedCard && selectedCard !== card) {
    selectedCard.classList.remove('selected');
    const prev = selectedCard.querySelector('.cta-check');
    if (prev) prev.style.opacity = '0';
  }
  const isSelected = card.classList.toggle('selected');
  if (isSelected) {
    selectedCard = card;
    selectedData = {
      name: card.dataset.name, role: card.dataset.role,
      number: card.dataset.number, emoji: card.dataset.emoji,
      charId: card.dataset.charId,
      roleClass: card.className.match(/role-\w+/)?.[0] || ''
    };
    updateStartBar(true);
  } else {
    selectedCard = null;
    updateStartBar(false);
  }
}

function updateStartBar(visible) {
  const bar = document.getElementById('startBar');
  bar.classList.toggle('visible', visible);
  if (visible) {
    const avatar = document.getElementById('selectedAvatar');
    avatar.textContent = selectedData.emoji;
    avatar.style.background = ROLE_COLORS[selectedData.roleClass] || '#374151';
    document.getElementById('selectedName').textContent = selectedData.name;
    document.getElementById('selectedRole').textContent = selectedData.role;
    document.getElementById('startBtn').style.background = ROLE_COLORS[selectedData.roleClass] || '#374151';
  }
}

function goToChat() {
  if (!selectedData.number) return;
  window.location.href = `chat.html?scenario_id=${scenarioId}&character=${selectedData.number}`;
}

/* ── 상세 모달 ── */
function openModal(charId) {
  const c = allChars.find(ch => String(ch.id) === String(charId));
  if (!c) return;

  const roleClass = ROLE_CLASS[c.role_level] || 'role-member';
  const color     = ROLE_COLORS[roleClass] || '#134e4a';
  const emoji     = ROLE_EMOJI[c.role_level] || '👤';
  const selectable = c.is_selectable;

  // 액센트 바
  const bar = document.getElementById('modalAccentBar');
  bar.style.background = color;

  // 역할 뱃지
  const badge = document.getElementById('modalRoleBadge');
  badge.textContent = c.role_level;
  badge.className = `role-badge ${roleClass}`;

  // 신원
  document.getElementById('modalName').textContent = `${emoji} ${c.name}`;
  document.getElementById('modalDept').textContent  = c.department || '';

  // 핵심 마인드
  const mindsetEl = document.getElementById('modalMindset');
  mindsetEl.textContent = c.core_mindset || '';
  mindsetEl.style.borderLeftColor = color;

  // 상황
  document.getElementById('modalSituation').textContent = c.situation || '—';

  // 미션
  document.getElementById('modalMission').textContent   = c.mission || '—';

  // 첫 발화 힌트 (detail에 있는 경우)
  const hintWrap  = document.getElementById('modalHintWrap');
  const hintsEl   = document.getElementById('modalHints');
  const hints = c.first_utterances || c.detail?.first_utterances || [];
  if (hints.length > 0 && selectable) {
    hintsEl.innerHTML = hints.slice(0, 3).map(h => `<div class="modal-hint-item">${esc(h)}</div>`).join('');
    hintWrap.classList.remove('hidden');
  } else {
    hintWrap.classList.add('hidden');
  }

  // CTA
  const startBtn   = document.getElementById('modalStartBtn');
  const ctxNote    = document.getElementById('modalContextNote');
  if (selectable) {
    startBtn.classList.remove('hidden');
    ctxNote.classList.add('hidden');
    startBtn.style.background = color;
    startBtn.dataset.charNumber = String(c.card_number).padStart(2, '0');
    startBtn.dataset.charId = c.id;
  } else {
    startBtn.classList.add('hidden');
    ctxNote.classList.remove('hidden');
  }

  // 오버레이 열기
  document.getElementById('charModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // 선택 하이라이트 (선택 가능 카드만)
  if (selectable) selectCardById(charId);
}

function closeModal() {
  document.getElementById('charModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ── 모달 이벤트 ── */
function bindModalEvents() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('charModalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('charModalOverlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.getElementById('modalStartBtn').addEventListener('click', () => {
    const btn = document.getElementById('modalStartBtn');
    window.location.href = `chat.html?scenario_id=${scenarioId}&character=${btn.dataset.charNumber}`;
  });
}

initPage();
