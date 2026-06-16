/* ── Phase C v3: 대화 상대 선택 (다중 선택 가능) ── */
const ROLE_CLASS  = { '상위리더': 'role-executive', '그룹장': 'role-manager', '파트장': 'role-lead', '부서원': 'role-member' };
const ROLE_COLORS = { 'role-executive': '#312E2B', 'role-manager': '#1B3250', 'role-lead': '#1A3D30', 'role-member': '#6B3B1D' };
const MAX_PARTNERS = 3;

const params        = new URLSearchParams(location.search);
const scenarioId    = params.get('scenario_id') || '1';
const learnerCharId = params.get('learner_char');

let allChars         = [];
let selectedPartners = new Set();
let recommendedMap   = new Map(); // character_id → reason

/* ── 초기화 ── */
async function initPage() {
  if (!learnerCharId) {
    window.location.href = `character-select.html?scenario_id=${scenarioId}`;
    return;
  }
  await Promise.all([loadScenarioInfo(), loadCharacters()]);
  document.getElementById('loadingState')?.remove();
  bindCardEvents();
  bindBarEvents();
}

async function loadScenarioInfo() {
  try {
    const res = await fetch(`/api/scenarios/${scenarioId}`);
    const s   = await res.json();
    const label = document.getElementById('scenarioLabel');
    if (label) label.textContent = s.case_name || s.title || '';
  } catch {}
}

async function loadCharacters() {
  const grid = document.getElementById('cardGrid');
  try {
    const res  = await fetch(`/api/scenarios/${scenarioId}/characters`);
    allChars   = await res.json();

    // 학습자 역할 카드 표시
    const learnerChar = allChars.find(c => String(c.id) === String(learnerCharId));
    if (learnerChar) {
      const emoji = learnerChar.emoji || getDefaultEmoji(learnerChar.role_level);
      document.getElementById('myRoleEmoji').textContent = emoji;
      document.getElementById('myRoleName').textContent  = learnerChar.name;
      document.getElementById('myRoleDept').textContent  = learnerChar.department || '';

      // 추천 대화 상대 매핑 (recommended_first_partners)
      const recs = learnerChar.learner_detail?.recommended_first_partners || [];
      recommendedMap.clear();
      recs.forEach(r => {
        if (typeof r === 'object' && r.character_id) {
          recommendedMap.set(String(r.character_id), r.reason || '추천 대화 상대');
        } else if (typeof r === 'number' || typeof r === 'string') {
          recommendedMap.set(String(r), '추천 대화 상대');
        }
      });
    }

    // 학습자 역할 캐릭터 제외 → 나머지 모두 상대 후보
    const partners = allChars.sort((a, b) => a.card_number - b.card_number);
    if (!partners.length) {
      grid.innerHTML = '<p class="empty-state grid-span-full">대화 상대 캐릭터가 없습니다.</p>';
      return;
    }
    grid.innerHTML = partners.map((c, i) => buildPartnerCardHTML(c, i)).join('');
    document.dispatchEvent(new Event('partnersLoaded'));
  } catch {
    grid.innerHTML = '<p class="empty-state grid-span-full">캐릭터 정보를 불러올 수 없습니다.</p>';
  }
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getDefaultEmoji(roleLevel) {
  const map = { '상위리더': '👔', '그룹장': '📊', '파트장': '⚡', '부서원': '💼' };
  return map[roleLevel] || '👤';
}

/* ── 파트너 카드 HTML ── */
function buildPartnerCardHTML(c, idx) {
  const roleClass    = ROLE_CLASS[c.role_level] || 'role-member';
  const emoji        = c.emoji || getDefaultEmoji(c.role_level);
  const num          = String(c.card_number).padStart(2, '0');
  const isLearner    = String(c.id) === String(learnerCharId);
  const isRecommended = !isLearner && recommendedMap.has(String(c.id));
  const recReason    = isRecommended ? recommendedMap.get(String(c.id)) : '';

  // 상황 요약 1줄
  const sitShort = (c.situation || '').slice(0, 50) + ((c.situation || '').length > 50 ? '...' : '');
  // 핵심 마인드 1줄 — 본인 역할 카드만 내면 표시, 상대 카드는 공개 직무로
  const mindShort = isLearner
    ? ((c.core_mindset || '').slice(0, 45) + ((c.core_mindset || '').length > 45 ? '...' : ''))
    : ((c.situation  || '').slice(0, 45) + ((c.situation  || '').length > 45 ? '...' : ''));

  const learnerTag = isLearner ? '<span class="learner-tag">내 역할</span>' : '';
  const recBadge   = isRecommended
    ? `<div class="recommended-badge" aria-label="추천 대화 상대" title="${esc(recReason)}">💡 추천<span class="recommend-reason">${esc(recReason)}</span></div>`
    : '';

  return `
  <div class="partner-card ${roleClass}${isLearner ? ' is-learner' : ''}${isRecommended ? ' is-recommended' : ''}"
       data-char-id="${c.id}" data-number="${num}"
       data-name="${esc(c.name)}" data-emoji="${emoji}"
       data-role="${esc(c.role_level)}"
       ${!isLearner ? 'tabindex="0" role="checkbox" aria-checked="false"' : ''}
       ${!isLearner ? `aria-label="${esc(c.name)} 선택"` : ''}>
    <div class="partner-card-accent"></div>
    ${recBadge}
    ${!isLearner ? '<div class="partner-checkbox"><div class="checkbox-inner"></div></div>' : ''}
    <div class="card-body">
      <div class="card-meta">
        <span class="card-emoji">${emoji}</span>
        <span class="role-badge">${esc(c.role_level)}</span>
        <span class="card-number">NO. ${num}</span>
        ${learnerTag}
      </div>
      <div class="card-identity">
        <p class="char-name">${esc(c.name)}</p>
        <p class="char-dept">${esc(c.department)}</p>
      </div>
      <p class="card-mindset-short">${esc(mindShort)}</p>
      <p class="card-situation-short">${esc(sitShort)}</p>
    </div>
  </div>`;
}

/* ── 이벤트 바인딩 ── */
function bindCardEvents() {
  document.querySelectorAll('.partner-card:not(.is-learner)').forEach(card => {
    card.addEventListener('click', () => togglePartner(card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') togglePartner(card); });
  });
}

function togglePartner(card) {
  const charId = card.dataset.charId;
  if (selectedPartners.has(charId)) {
    selectedPartners.delete(charId);
    card.classList.remove('selected');
    card.setAttribute('aria-checked', 'false');
  } else {
    if (selectedPartners.size >= MAX_PARTNERS) return;
    selectedPartners.add(charId);
    card.classList.add('selected');
    card.setAttribute('aria-checked', 'true');
  }
  updateBar();
}

function updateBar() {
  const bar = document.getElementById('partnerBar');
  const partnersEl = document.getElementById('selectedPartners');
  if (selectedPartners.size > 0) {
    bar.classList.remove('hidden');
    // 선택된 파트너 아바타 표시 (DOM property 방식 — CSP 무관)
    partnersEl.innerHTML = '';
    [...selectedPartners].forEach(id => {
      const c = allChars.find(ch => String(ch.id) === id);
      if (!c) return;
      const roleClass = ROLE_CLASS[c.role_level] || 'role-member';
      const color = ROLE_COLORS[roleClass] || '#1A3D30';
      const emoji = c.emoji || getDefaultEmoji(c.role_level);
      const chip = document.createElement('div');
      chip.className = 'partner-chip';
      chip.style.background = color;
      chip.textContent = `${emoji} ${c.name.split(' ')[0]}`;
      partnersEl.appendChild(chip);
    });
  } else {
    bar.classList.add('hidden');
  }
}

/* ── 바 이벤트 ── */
function bindBarEvents() {
  document.getElementById('changeRoleBtn').addEventListener('click', () => {
    window.location.href = `character-select.html?scenario_id=${scenarioId}`;
  });

  document.getElementById('startChatBtn').addEventListener('click', () => {
    if (selectedPartners.size === 0) return;
    const partnerIds = [...selectedPartners].join(',');
    window.location.href = `chat.html?scenario_id=${scenarioId}&learner_char=${learnerCharId}&partners=${partnerIds}`;
  });
}

initPage();
