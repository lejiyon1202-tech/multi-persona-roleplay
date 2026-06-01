const ROLE_CLASS = { '상위리더': 'role-executive', '그룹장': 'role-manager', '파트장': 'role-lead', '부서원': 'role-member' };
const ROLE_EMOJI = { '상위리더': '👔', '그룹장': '📊', '파트장': '⚡', '부서원': '💼' };
const ROLE_COLORS = { 'role-executive': '#312e81', 'role-manager': '#1e3a8a', 'role-lead': '#134e4a', 'role-member': '#78350f' };

const params = new URLSearchParams(location.search);
const scenarioId = params.get('scenario_id') || '1';

let selectedCard = null;
let selectedData = {};

/* ── 페이지 초기화 ── */
async function initPage() {
  await Promise.all([loadScenarioInfo(), loadCharacters()]);
  document.getElementById('loadingState')?.remove();
  bindCardEvents();
}

async function loadScenarioInfo() {
  try {
    const res = await fetch(`/api/scenarios/${scenarioId}`);
    const s = await res.json();
    const label = document.getElementById('scenarioLabel');
    const desc  = document.getElementById('scenarioDesc');
    if (label) label.textContent = s.case_name || s.title || '';
    if (desc)  desc.textContent  = s.context_description || '';
  } catch {
    const label = document.getElementById('scenarioLabel');
    if (label) label.textContent = 'Case Study';
  }
}

async function loadCharacters() {
  const grid = document.getElementById('cardGrid');
  try {
    const res  = await fetch(`/api/scenarios/${scenarioId}/characters`);
    const chars = await res.json();
    if (!chars.length) { grid.innerHTML = '<p class="empty-state grid-span-full">등록된 캐릭터가 없습니다.</p>'; return; }
    grid.innerHTML = chars
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

function buildCardHTML(c, idx) {
  const roleClass = ROLE_CLASS[c.role_level] || 'role-member';
  const emoji     = ROLE_EMOJI[c.role_level] || '👤';
  const num       = String(c.card_number).padStart(2, '0');
  const selectable = c.is_selectable;

  const contextOverlay = !selectable ? '<div class="context-overlay">컨텍스트</div>' : '';
  const ctaBlock = selectable ? `
    <div class="card-cta">
      <button class="cta-btn" data-char-number="${num}">
        대화 시작
        <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
      <div class="cta-check">
        <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
    </div>` : '';

  return `
  <div class="char-card ${roleClass}${selectable ? ' selectable' : ' context-only'}"
       data-role="${esc(c.role_level)}" data-selectable="${selectable ? 'true' : 'false'}"
       data-number="${num}" data-name="${esc(c.name)}" data-emoji="${emoji}">
    <div class="card-accent-bar"></div>
    ${contextOverlay}
    <div class="card-body">
      <div class="card-meta">
        <span class="role-badge">${esc(c.role_level)}</span>
        <span class="card-number">NO. ${num}</span>
      </div>
      <div class="card-identity">
        <p class="char-name">${esc(c.name)}</p>
        <p class="char-dept">${esc(c.department)}</p>
      </div>
      <blockquote class="card-mindset">${esc(c.core_mindset)}</blockquote>
      <div class="card-context">
        <div class="context-section">
          <p class="context-label">상황 · 감정</p>
          <p class="context-text">${esc(c.situation)}</p>
        </div>
        <div class="card-divider"></div>
        <div class="context-section">
          <p class="context-label">롤플레이 미션</p>
          <p class="context-text">${esc(c.mission)}</p>
        </div>
      </div>
      ${ctaBlock}
    </div>
  </div>`;
}

/* ── 이벤트 바인딩 ── */
function bindCardEvents() {
  document.querySelectorAll('.char-card.selectable').forEach(card => {
    card.addEventListener('click', () => selectCard(card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectCard(card); });
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${card.dataset.name} 선택 — ${card.dataset.role}`);
  });

  document.querySelectorAll('.cta-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.location.href = `chat.html?scenario_id=${scenarioId}&character=${btn.dataset.charNumber}`;
    });
  });
}

document.getElementById('startBtn').addEventListener('click', goToChat);

function selectCard(card) {
  if (selectedCard && selectedCard !== card) {
    selectedCard.classList.remove('selected');
    const prev = selectedCard.querySelector('.cta-check');
    if (prev) prev.style.opacity = '0';
  }
  const isSelected = card.classList.toggle('selected');
  const check = card.querySelector('.cta-check');
  if (isSelected) {
    selectedCard = card;
    if (check) check.style.opacity = '1';
    selectedData = {
      name: card.dataset.name, role: card.dataset.role,
      number: card.dataset.number, emoji: card.dataset.emoji,
      roleClass: card.className.match(/role-\w+/)?.[0] || ''
    };
    updateStartBar(true);
  } else {
    selectedCard = null;
    if (check) check.style.opacity = '0';
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

initPage();
