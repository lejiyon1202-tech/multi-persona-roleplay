/* ── 상태 ── */
const params = new URLSearchParams(location.search);
const SCENARIO_ID      = params.get('scenario_id');
const CHARACTER_ID     = params.get('character');
const LEARNER_CHAR_ID  = params.get('learner_char') || null;
const PARTNER_IDS      = (params.get('partners') || '').split(',').filter(Boolean);
const IS_V3            = !!LEARNER_CHAR_ID;
const SESSION_ID       = params.get('session_id') || null;

let activePartnerId = IS_V3 ? (PARTNER_IDS[0] || null) : CHARACTER_ID;

const ROLE_COLORS = { executive:'#312E2B', manager:'#1B3250', lead:'#1A3D30', member:'#6B3B1D' };
const ROLE_MAP    = { '상위리더':'executive','그룹장':'manager','파트장':'lead','부서원':'member' };

let sessionId      = SESSION_ID;
let turnCount      = 0;
let isWaiting      = false;
let charData       = null;
let partnersMap    = {};   // v3: { charId: charObj }
let lastSpeakerId  = null; // Phase E B안: 발화자 연속 여부 추적

/* ── 뒤로가기 ── */
document.getElementById('backBtn').addEventListener('click', () => {
  if (turnCount > 0 && !confirm('대화를 중단하시겠습니까? 진행 내용은 저장되지 않습니다.')) return;
  history.back();
});

/* ── 입력창 auto-resize ── */
const msgInput = document.getElementById('msgInput');
const sendBtn  = document.getElementById('sendBtn');

msgInput.addEventListener('input', () => {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
  sendBtn.disabled = msgInput.value.trim().length === 0 || isWaiting;
});

msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);
document.getElementById('endChatBtn').addEventListener('click', endChat);

/* ── 헬퍼 ── */
function getRoleKey(roleLevel) {
  return ROLE_MAP[roleLevel] || 'lead';
}

/* ── 캐릭터 정보 로드 ── */
async function loadCharacter() {
  if (IS_V3) { await loadAllPartners(); return; }
  try {
    const res  = await fetch(`/api/scenarios/${SCENARIO_ID}/characters/${CHARACTER_ID}`);
    const data = await res.json();
    charData = data.character;
    applyCharacterUI(charData);
    await initSession();
  } catch {
    applyDemoCharacter();
    addSystemMsg('데모 모드: 서버에 연결할 수 없어 데모로 실행됩니다.');
  }
}

/* ── v3: 모든 파트너 로드 ── */
async function loadAllPartners() {
  try {
    const fetches = PARTNER_IDS.map(id =>
      fetch(`/api/scenarios/${SCENARIO_ID}/characters/${id}`)
        .then(r => r.json())
        .then(d => { if (d.character) partnersMap[id] = d.character; })
        .catch(() => {})
    );
    await Promise.all(fetches);
  } catch { /* 데모 모드 폴백 */ }
  renderPartnersStrip();
  updateTargetIndicator();
  await initSession();
}

/* ── v3: 파트너 스트립 렌더링 ── */
function renderPartnersStrip() {
  const strip    = document.getElementById('partnersStrip');
  const charMini = document.getElementById('charMini');
  if (!IS_V3) return;

  strip.innerHTML = '';
  strip.classList.remove('hidden');
  charMini.classList.add('hidden');

  PARTNER_IDS.forEach(id => {
    const char = partnersMap[id];
    const label = char ? char.name : id;
    const roleKey = char ? getRoleKey(char.role_level) : 'lead';
    const color = ROLE_COLORS[roleKey];
    const initial = char?.name ? char.name[0] : '?';

    const chip = document.createElement('button');
    chip.className = 'partner-chip' + (id === activePartnerId ? ' active' : '');
    chip.dataset.id = id;
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', id === activePartnerId ? 'true' : 'false');
    if (id === activePartnerId) chip.style.borderColor = color;

    chip.innerHTML = `
      <div class="partner-chip-avatar">${initial}</div>
      <div class="partner-chip-info">
        <span class="partner-chip-name">${label}</span>
        <span class="partner-chip-role">${char?.role_level || ''}</span>
      </div>`;
    chip.querySelector('.partner-chip-avatar').style.background = color;
    chip.addEventListener('click', () => switchPartner(id));
    strip.appendChild(chip);
  });

  syncTypingAndSend();
}

/* ── v3: 파트너 전환 ── */
function switchPartner(id) {
  activePartnerId = id;
  document.querySelectorAll('.partner-chip').forEach(c => {
    const on = c.dataset.id === id;
    c.classList.toggle('active', on);
    c.setAttribute('aria-selected', on ? 'true' : 'false');
    c.style.borderColor = on ? ROLE_COLORS[getRoleKey(partnersMap[id]?.role_level)] : '';
  });
  updateTargetIndicator();
  syncTypingAndSend();
}

/* ── v3: 타이핑 아바타 + 전송 버튼 색 동기화 ── */
function syncTypingAndSend() {
  const char  = partnersMap[activePartnerId];
  const color = char ? ROLE_COLORS[getRoleKey(char.role_level)] : ROLE_COLORS.lead;
  const initial = char?.name ? char.name[0] : '?';
  document.getElementById('typingAvatar').textContent = initial;
  document.getElementById('typingAvatar').style.background = color;
  document.querySelectorAll('.send-btn').forEach(b => b.style.background = color);
}

/* ── v3: 전송 대상 표시 ── */
function updateTargetIndicator() {
  if (!IS_V3) return;
  const char  = partnersMap[activePartnerId];
  const color = char ? ROLE_COLORS[getRoleKey(char.role_level)] : '#1A3D30';
  const name  = char?.name || `캐릭터 ${activePartnerId}`;
  const el    = document.getElementById('targetIndicator');
  el.classList.remove('hidden');
  el.innerHTML = '';
  const arrow = document.createElement('span');
  arrow.style.color = color;
  arrow.textContent = '▶';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'target-name';
  nameSpan.style.color = color;
  nameSpan.textContent = name;
  el.appendChild(arrow);
  el.appendChild(nameSpan);
  el.appendChild(document.createTextNode('에게 전송'));
}

function applyCharacterUI(char) {
  const roleKey = getRoleKey(char.role_level);
  const color   = ROLE_COLORS[roleKey];

  document.getElementById('miniAvatar').textContent = char.name ? char.name[0] : '?';
  document.getElementById('miniAvatar').style.background = color;
  document.getElementById('typingAvatar').textContent = char.name ? char.name[0] : '?';
  document.getElementById('typingAvatar').style.background = color;
  document.getElementById('miniName').textContent = char.name || '—';
  document.getElementById('miniRole').textContent = char.role_level || '—';
  document.title = `${char.name}과 대화 — AI 대화 학습`;
  document.querySelectorAll('.send-btn').forEach(b => b.style.background = color);

  if (char.emotion_stages?.length > 0) {
    const badge = document.getElementById('emotionBadge');
    badge.textContent = char.emotion_stages[0].stage || '초기';
    badge.classList.remove('hidden');
  }
}

function applyDemoCharacter() {
  charData = { id: 3, name: '이모델 파트장', role_level: '파트장',
    persona_prompt: '당신은 AI혁신센터의 파트장입니다.', emotion_stages: [{stage:'방어'}] };
  applyCharacterUI(charData);
}

/* ── 세션 초기화 ── */
async function initSession() {
  if (sessionId) return;
  try {
    const body = IS_V3
      ? { learner_id: 1, scenario_id: SCENARIO_ID,
          learner_character_id: Number(LEARNER_CHAR_ID),
          dialogue_partner_ids: PARTNER_IDS.map(Number) }
      : { learner_id: 1, scenario_id: SCENARIO_ID, character_id: CHARACTER_ID };

    const res  = await fetch('/api/sessions', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
    });
    const data = await res.json();
    sessionId  = data.session_id;
  } catch { /* 데모 모드 */ }
}

/* ── 메시지 전송 ── */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || isWaiting) return;

  isWaiting = true;
  sendBtn.disabled = true;
  msgInput.value = '';
  msgInput.style.height = 'auto';

  turnCount++;
  updateTurnUI();
  appendMsg('user', text);
  showTyping(true);

  try {
    const chatBody = { session_id: sessionId, message: text };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(chatBody),
    });
    if (!res.ok) throw new Error('Chat API error');

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let aiText        = '';
    let msgEl         = null;
    let currentCharId = null;

    showTyping(true);  // 서버 선별 중 초기 인디케이터

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data:'));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(5).trim());

          // 새 캐릭터 응답 시작 (character_id + character_name, token·done 없음)
          if (json.character_id && json.character_name && !json.token && !json.done) {
            showTyping(true, json.character_name);
            if (IS_V3) switchPartner(json.character_id);
            currentCharId = json.character_id;
            aiText = '';
            msgEl  = null;
          }

          // 토큰 스트리밍
          if (json.token) {
            if (!msgEl) {
              showTyping(false);
              msgEl = appendMsg('ai', '', true, currentCharId);
            }
            aiText += json.token;
            updateMsgEl(msgEl, aiText);
          }

          // 캐릭터 응답 완료
          if (json.done) {
            if (!aiText && msgEl) updateMsgEl(msgEl, '(응답 없음)');
            aiText = '';
            msgEl  = null;
          }

          if (json.emotion_stage) updateEmotionBadge(json.emotion_stage);
        } catch { /* partial chunk */ }
      }
    }
  } catch (err) {
    showTyping(false);
    appendMsg('ai', `데모 응답입니다. 실제 서버에 연결하면 AI 캐릭터의 응답이 여기에 표시됩니다. (오류: ${err.message})`, false, null);
  }

  isWaiting = false;
  sendBtn.disabled = false;
  msgInput.focus();
}

/* ── 대화 종료 ── */
async function endChat() {
  if (turnCount < 3) return;
  const endBtn = document.getElementById('endChatBtn');
  endBtn.disabled = true;
  endBtn.classList.add('evaluating');
  endBtn.textContent = '평가 중...';
  try {
    await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch { /* 평가 실패해도 리포트로 이동 */ }
  window.location.href = `report.html?session_id=${sessionId}`;
}

/* ── 메시지 추가 ── */
function appendMsg(role, text, streaming = false, speakerCharId = null) {
  const wrap = document.getElementById('messagesWrap');

  let char = charData || {};
  if (IS_V3 && role === 'ai') {
    char = partnersMap[speakerCharId || activePartnerId] || {};
  }
  const color      = ROLE_COLORS[getRoleKey(char.role_level)];
  const avatarText = role === 'ai' ? (char.name ? char.name[0] : 'A') : '나';
  const avatarBg   = role === 'ai' ? color : '#374151';

  const div = document.createElement('div');
  div.className = `msg ${role}`;

  // Phase E B안: 발화자 전환 여부에 따라 CSS 클래스 적용 (기안84 단톡방 디자인)
  if (role === 'ai') {
    if (lastSpeakerId !== null && speakerCharId === lastSpeakerId) {
      div.classList.add('msg-continuous');  // 같은 캐릭터 연속 발화
    } else if (lastSpeakerId !== null) {
      div.classList.add('msg-new-char');    // 다른 캐릭터로 전환
    }
    lastSpeakerId = speakerCharId;
  }

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = avatarText;
  avatar.style.background = avatarBg;

  const inner = document.createElement('div');

  // v3: AI 발화자 이름 라벨
  if (IS_V3 && role === 'ai' && char.name && PARTNER_IDS.length > 1) {
    const speaker = document.createElement('div');
    speaker.className = 'msg-speaker-name';
    speaker.textContent = char.name;
    speaker.style.color = color;
    inner.appendChild(speaker);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;
  if (role === 'ai') bubble.style.borderLeftColor = color;
  else               bubble.style.background      = color;

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = now();

  inner.appendChild(bubble);
  inner.appendChild(time);
  div.appendChild(avatar);
  div.appendChild(inner);
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return bubble;
}

function updateMsgEl(el, text) {
  if (el) el.textContent = text;
  document.getElementById('messagesWrap').scrollTop = 999999;
}

function addSystemMsg(text) {
  const wrap = document.getElementById('messagesWrap');
  const div = document.createElement('div');
  div.className = 'stage-change-notice';
  div.textContent = text;
  wrap.appendChild(div);
  wrap.scrollTop = 999999;
}

function showTyping(show, charName) {
  document.getElementById('typingIndicator').classList.toggle('hidden', !show);
  if (show) {
    const nameEl = document.getElementById('typingCharName');
    if (nameEl) nameEl.textContent = charName ? `${charName}이 입력 중...` : '';
    document.getElementById('messagesWrap').scrollTop = 999999;
  }
}

function updateEmotionBadge(stage) {
  const badge = document.getElementById('emotionBadge');
  badge.textContent = stage;
  badge.classList.remove('hidden');
  addSystemMsg(`감정 단계 전환: ${stage}`);
}

function updateTurnUI() {
  document.getElementById('turnCounter').textContent = `${turnCount} 턴`;
  const endBtn = document.getElementById('endChatBtn');
  const info   = document.getElementById('turnInfo');
  if (turnCount >= 3) {
    endBtn.disabled = false;
    info.textContent = `${turnCount}턴 완료 — 평가 받기 가능`;
  } else {
    info.textContent = `${3 - turnCount}턴 더 대화하면 평가 가능`;
  }
}

function now() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadCharacter();
