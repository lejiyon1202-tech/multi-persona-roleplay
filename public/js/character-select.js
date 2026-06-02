/* ── Phase C v3: 학습자 연기 캐릭터 선택 ── */
const ROLE_CLASS  = { '상위리더': 'role-executive', '그룹장': 'role-manager', '파트장': 'role-lead', '부서원': 'role-member' };
const ROLE_COLORS = { 'role-executive': '#312E2B', 'role-manager': '#1B3250', 'role-lead': '#1A3D30', 'role-member': '#6B3B1D' };

const params     = new URLSearchParams(location.search);
const scenarioId = params.get('scenario_id') || '1';

let allChars = [];

/* ── 초기화 ── */
async function initPage() {
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
  const color     = ROLE_COLORS[roleClass] || '#134e4a';
  const emoji     = c.emoji || getDefaultEmoji(c.role_level);
  const ld        = c.learner_detail || {};

  document.getElementById('modalAccentBar').style.background = color;

  const badge = document.getElementById('modalRoleBadge');
  badge.textContent = c.role_level;
  badge.className = `role-badge ${roleClass}`;

  document.getElementById('modalName').textContent = `${emoji} ${c.name}`;
  document.getElementById('modalDept').textContent  = c.department || '';

  const mindsetEl = document.getElementById('modalMindset');
  mindsetEl.textContent = c.core_mindset || '';
  mindsetEl.style.borderLeftColor = color;

  // 연기용 detail (있으면 표시, 없으면 기본 필드 사용)
  document.getElementById('modalBackground').textContent = ld.background || c.situation || '—';
  document.getElementById('modalValues').textContent     = ld.values || c.core_mindset || '—';
  document.getElementById('modalPressure').textContent   = ld.pressures || ld.inner_conflict || c.situation || '—';
  document.getElementById('modalMission').textContent    = ld.mission || c.mission || '—';

  // 말투·관계·감정 단계 (신규 섹션 — 기안84 확정 ID)
  const speechEl = document.getElementById('modalSpeechStyle');
  if (speechEl) speechEl.textContent = ld.speech_style || ld.speaking_style || '—';

  const relEl = document.getElementById('modalRelationships');
  if (relEl) relEl.textContent = ld.relationships || '—';

  const emoEl = document.getElementById('modalEmotionalStates');
  if (emoEl) {
    if (Array.isArray(ld.emotional_states) && ld.emotional_states.length > 0) {
      emoEl.innerHTML = ld.emotional_states.map(es =>
        `<div class="modal-stage">
          <span class="stage-label">${esc(es.stage)}</span>
          <p class="stage-trigger">${esc(es.trigger)}</p>
          <p class="stage-example">"${esc(es.example)}"</p>
        </div>`
      ).join('');
      emoEl.closest('.modal-section')?.classList.remove('hidden');
    } else {
      emoEl.closest('.modal-section')?.classList.add('hidden');
    }
  }

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

  // CTA 버튼
  const selectBtn = document.getElementById('modalSelectBtn');
  selectBtn.style.background = color;
  selectBtn.dataset.charId = charId;

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

initPage();
