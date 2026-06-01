/* ── 상태 ── */
const params = new URLSearchParams(location.search);
const CHARACTER_ID = params.get('character');
const SESSION_ID   = params.get('session_id') || null;

const ROLE_COLORS = { executive: '#312e81', manager: '#1e3a8a', lead: '#134e4a', member: '#78350f' };

let sessionId   = SESSION_ID;
let turnCount   = 0;
let isWaiting   = false;
let charData    = null;

/* ── 테마 전환 ── */
document.querySelectorAll('[data-theme-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.themeTarget;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-target]').forEach(b =>
      b.classList.toggle('active', b.dataset.themeTarget === theme)
    );
  });
});

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

/* ── 캐릭터 정보 로드 ── */
async function loadCharacter() {
  try {
    const res  = await fetch(`/api/characters/${CHARACTER_ID}`);
    const data = await res.json();
    charData = data.character;
    applyCharacterUI(charData);
    await initSession();
  } catch {
    applyDemoCharacter();
    addSystemMsg('데모 모드: 서버에 연결할 수 없어 데모로 실행됩니다.');
  }
}

function applyCharacterUI(char) {
  const roleKey = { '상위리더':'executive','그룹장':'manager','파트장':'lead','부서원':'member' }[char.role_level] || 'lead';
  const color   = ROLE_COLORS[roleKey];

  document.getElementById('miniAvatar').textContent = char.name ? char.name[0] : '?';
  document.getElementById('miniAvatar').style.background = color;
  document.getElementById('typingAvatar').textContent = char.name ? char.name[0] : '?';
  document.getElementById('typingAvatar').style.background = color;
  document.getElementById('miniName').textContent = char.name || '—';
  document.getElementById('miniRole').textContent = char.role_level || '—';
  document.title = `${char.name}과 대화 — AI 롤플레잉`;

  document.querySelectorAll('.send-btn').forEach(b => b.style.background = color);

  if (char.emotion_stages && char.emotion_stages.length > 0) {
    const badge = document.getElementById('emotionBadge');
    badge.textContent = char.emotion_stages[0].stage || '초기';
    badge.classList.remove('hidden');
  }
}

function applyDemoCharacter() {
  charData = { id: 3, name: '이모델 파트장', role_level: '파트장',
    persona_prompt: '당신은 AI센터의 파트장입니다.', emotion_stages: [{stage:'방어'}] };
  applyCharacterUI(charData);
}

/* ── 세션 초기화 ── */
async function initSession() {
  if (sessionId) return;
  try {
    const res  = await fetch('/api/sessions', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ character_id: CHARACTER_ID, learner_id: 1 })
    });
    const data = await res.json();
    sessionId = data.session_id;
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
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ session_id: sessionId, message: text })
    });

    if (!res.ok) throw new Error('Chat API error');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let aiText = '';
    let msgEl = null;

    showTyping(false);
    msgEl = appendMsg('ai', '', true);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data:'));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(5).trim());
          if (json.token) {
            aiText += json.token;
            updateMsgEl(msgEl, aiText);
          }
          if (json.emotion_stage) updateEmotionBadge(json.emotion_stage);
        } catch { /* partial chunk */ }
      }
    }
    if (!aiText) updateMsgEl(msgEl, '(응답 없음)');
  } catch (err) {
    showTyping(false);
    appendMsg('ai', `데모 응답입니다. 실제 서버에 연결하면 AI 캐릭터의 응답이 여기에 표시됩니다. (오류: ${err.message})`);
  }

  isWaiting = false;
  sendBtn.disabled = false;
  msgInput.focus();
}

/* ── 대화 종료 ── */
function endChat() {
  if (turnCount < 3) return;
  window.location.href = `report.html?session_id=${sessionId}`;
}

/* ── UI 헬퍼 ── */
function appendMsg(role, text, streaming = false) {
  const wrap = document.getElementById('messagesWrap');
  const char = charData || {};
  const roleKey = { '상위리더':'executive','그룹장':'manager','파트장':'lead','부서원':'member' }[char.role_level] || 'lead';
  const color = ROLE_COLORS[roleKey];

  const avatarText = role === 'ai' ? (char.name ? char.name[0] : 'A') : '나';
  const avatarBg   = role === 'ai' ? color : '#374151';

  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar" style="background:${avatarBg}">${avatarText}</div>
    <div>
      <div class="msg-bubble ${role === 'ai' ? '' : ''}" style="${
        role === 'ai'
          ? `border-left-color:${color}`
          : `background:${color}`
      }">${escHtml(text)}</div>
      <div class="msg-time">${now()}</div>
    </div>`;
  if (role === 'ai') {
    div.querySelector('.msg-bubble').style.borderLeftColor = color;
  }
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div.querySelector('.msg-bubble');
}

function updateMsgEl(el, text) {
  if (el) el.textContent = text;
  const wrap = document.getElementById('messagesWrap');
  wrap.scrollTop = wrap.scrollHeight;
}

function addSystemMsg(text) {
  const wrap = document.getElementById('messagesWrap');
  const div = document.createElement('div');
  div.className = 'stage-change-notice';
  div.textContent = text;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function showTyping(show) {
  document.getElementById('typingIndicator').classList.toggle('hidden', !show);
  if (show) {
    const wrap = document.getElementById('messagesWrap');
    wrap.scrollTop = wrap.scrollHeight;
  }
}

function updateEmotionBadge(stage) {
  const badge = document.getElementById('emotionBadge');
  badge.textContent = stage;
  badge.style.display = 'inline-flex';
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
