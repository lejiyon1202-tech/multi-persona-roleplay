let adminToken = sessionStorage.getItem('admin_token') || '';
const ROLE_COLORS = { executive:'#312e81', manager:'#1e3a8a', lead:'#134e4a', member:'#78350f' };
const ROLE_KEY = { '상위리더':'executive','그룹장':'manager','파트장':'lead','부서원':'member' };

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

/* ── 인증 ── */
if (adminToken) showAdmin();

document.getElementById('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const token = document.getElementById('tokenInput').value.trim();
  const ok = await verifyToken(token);
  if (ok) {
    adminToken = token;
    sessionStorage.setItem('admin_token', token);
    showAdmin();
  } else {
    document.getElementById('authError').classList.remove('hidden');
  }
});

async function verifyToken(token) {
  try {
    const res = await fetch('/api/admin/scenarios', { headers: { 'X-Admin-Token': token } });
    return res.ok;
  } catch { return false; }
}

function showAdmin() {
  document.getElementById('authOverlay').classList.add('hidden');
  document.getElementById('adminLayout').classList.remove('hidden');
  document.getElementById('adminLayout').style.display = 'flex';
  loadScenarios();
}

/* ── 사이드바 네비게이션 ── */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const section = item.dataset.section;
    document.getElementById('sectionScenarios').classList.toggle('hidden', section !== 'scenarios');
    document.getElementById('sectionLearners').classList.toggle('hidden',  section !== 'learners');
    document.getElementById('sectionStats').classList.toggle('hidden',     section !== 'stats');
    if (section === 'stats') loadStats();
  });
});

/* ── API 헬퍼 ── */
async function api(method, path, body) {
  const opts = { method, headers: { 'X-Admin-Token': adminToken, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

/* ── 시나리오 목록 ── */
async function loadScenarios() {
  const list = document.getElementById('scenarioList');
  try {
    const data = await api('GET', '/api/admin/scenarios');
    if (!data.scenarios || !data.scenarios.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><p class="empty-state-title">시나리오가 없습니다</p></div>`;
      return;
    }
    list.innerHTML = data.scenarios.map(s => `
      <div class="scenario-item">
        <div class="scenario-item-info">
          <p class="scenario-item-title">${escHtml(s.title)}</p>
          <p class="scenario-item-meta">${escHtml(s.case_name || '')} · 캐릭터 ${s.character_count || 0}명</p>
        </div>
        <div class="scenario-item-actions">
          <button class="icon-btn" data-action="edit-scenario" data-id="${s.id}" title="수정">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn" data-action="manage-chars" data-id="${s.id}" data-title="${escHtml(s.title)}" title="캐릭터 관리">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          </button>
          <button class="icon-btn danger" data-action="delete-scenario" data-id="${s.id}" data-title="${escHtml(s.title)}" title="삭제">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>`).join('');
    bindScenarioListEvents();
  } catch {
    list.innerHTML = `<div class="empty-state"><p class="empty-state-title">데이터를 불러오지 못했습니다</p></div>`;
  }
}

function bindScenarioListEvents() {
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { action, id, title } = btn.dataset;
      if (action === 'edit-scenario')   openScenarioModal(id);
      if (action === 'manage-chars')    openCharManager(id, title);
      if (action === 'delete-scenario') deleteScenario(id, title);
    });
  });
}

/* ── 시나리오 모달 ── */
document.getElementById('addScenarioBtn').addEventListener('click', () => openScenarioModal(null));
document.getElementById('scenarioCancelBtn').addEventListener('click', closeScenarioModal);
document.getElementById('scenarioForm').addEventListener('submit', saveScenario);

async function openScenarioModal(id) {
  document.getElementById('scenarioModalTitle').textContent = id ? '시나리오 수정' : '새 시나리오';
  document.getElementById('scenarioId').value = id || '';
  if (id) {
    try {
      const data = await api('GET', `/api/admin/scenarios/${id}`);
      const s = data.scenario;
      document.getElementById('fTitle').value       = s.title || '';
      document.getElementById('fCaseName').value    = s.case_name || '';
      document.getElementById('fContext').value     = s.context_description || '';
      document.getElementById('fLearnerRole').value = s.learner_role || '';
    } catch { /* 비어있는 채로 */ }
  } else {
    ['fTitle','fCaseName','fContext','fLearnerRole'].forEach(f => document.getElementById(f).value = '');
  }
  document.getElementById('scenarioModal').classList.remove('hidden');
}

function closeScenarioModal() { document.getElementById('scenarioModal').classList.add('hidden'); }

async function saveScenario(e) {
  e.preventDefault();
  const id   = document.getElementById('scenarioId').value;
  const body = {
    title:               document.getElementById('fTitle').value.trim(),
    case_name:           document.getElementById('fCaseName').value.trim(),
    context_description: document.getElementById('fContext').value.trim(),
    learner_role:        document.getElementById('fLearnerRole').value.trim()
  };
  try {
    if (id) await api('PUT',  `/api/admin/scenarios/${id}`, body);
    else    await api('POST', '/api/admin/scenarios', body);
    closeScenarioModal();
    loadScenarios();
  } catch (err) { alert('저장 실패: ' + err.message); }
}

async function deleteScenario(id, title) {
  if (!confirm(`"${title}" 시나리오를 삭제하시겠습니까?\n소속 캐릭터와 세션도 모두 삭제됩니다.`)) return;
  try { await api('DELETE', `/api/admin/scenarios/${id}`); loadScenarios(); }
  catch (err) { alert('삭제 실패: ' + err.message); }
}

/* ── 캐릭터 관리 ── */
async function openCharManager(scenarioId, scenarioTitle) {
  const list = document.getElementById('scenarioList');
  list.innerHTML = `
    <div class="mb16">
      <button class="btn btn-secondary btn-sm" id="backToScenarios">← 시나리오 목록</button>
      <span class="section-heading">${escHtml(scenarioTitle)} — 캐릭터</span>
    </div>
    <div class="text-right-mb12">
      <button class="btn btn-primary" id="addCharBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        캐릭터 추가
      </button>
    </div>
    <div class="char-admin-grid" id="charGrid">
      <div class="empty-state grid-span-full"><div class="spinner"></div></div>
    </div>`;

  document.getElementById('backToScenarios').addEventListener('click', loadScenarios);
  document.getElementById('addCharBtn').addEventListener('click', () => openCharModal(null, scenarioId));

  await loadChars(scenarioId);
}

async function loadChars(scenarioId) {
  const grid = document.getElementById('charGrid');
  try {
    const data = await api('GET', `/api/admin/scenarios/${scenarioId}/characters`);
    if (!data.characters || !data.characters.length) {
      grid.innerHTML = `<div class="empty-state grid-span-full"><p class="empty-state-title">캐릭터가 없습니다</p></div>`;
      return;
    }
    grid.innerHTML = data.characters.map(c => {
      const rk    = ROLE_KEY[c.role_level] || 'lead';
      const color = ROLE_COLORS[rk];
      return `
        <div class="char-admin-card">
          <div class="char-admin-bar role-bar ${rk}"></div>
          <div class="char-admin-body">
            <div class="flex-row-sm">
              <span class="role-badge ${rk}">${escHtml(c.role_level)}</span>
              ${!c.is_selectable ? '<span class="text-muted-sm">컨텍스트</span>' : ''}
            </div>
            <p class="char-admin-name">${escHtml(c.name)}</p>
            <p class="char-admin-role">${escHtml(c.department || '')}</p>
          </div>
          <div class="char-admin-actions">
            <button class="icon-btn" data-action="edit-char" data-id="${c.id}" data-scenario-id="${scenarioId}" title="수정">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn danger" data-action="delete-char" data-id="${c.id}" data-scenario-id="${scenarioId}" data-name="${escHtml(c.name)}" title="삭제">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, id, scenarioId: sid, name } = btn.dataset;
        if (action === 'edit-char')   openCharModal(id, sid);
        if (action === 'delete-char') deleteChar(id, sid, name);
      });
    });
  } catch {
    grid.innerHTML = `<div class="empty-state grid-span-full"><p class="empty-state-title">불러오기 실패</p></div>`;
  }
}

/* ── 캐릭터 모달 ── */
document.getElementById('charCancelBtn').addEventListener('click', () => document.getElementById('charModal').classList.add('hidden'));
document.getElementById('charForm').addEventListener('submit', saveChar);

async function openCharModal(charId, scenarioId) {
  document.getElementById('charModalTitle').textContent = charId ? '캐릭터 수정' : '새 캐릭터';
  document.getElementById('charId').value = charId || '';
  document.getElementById('charScenarioId').value = scenarioId;
  if (charId) {
    try {
      const data = await api('GET', `/api/admin/scenarios/${scenarioId}/characters/${charId}`);
      const c = data.character;
      document.getElementById('fCharName').value  = c.name || '';
      document.getElementById('fCharDept').value  = c.department || '';
      document.getElementById('fRoleLevel').value = c.role_level || '';
      document.getElementById('fSelectable').value = c.is_selectable ? '1' : '0';
      document.getElementById('fMindset').value   = c.core_mindset || '';
      document.getElementById('fSituation').value = c.situation || '';
      document.getElementById('fMission').value   = c.mission || '';
      document.getElementById('fPersona').value   = c.persona_prompt || '';
    } catch { /* 비어있는 채로 */ }
  } else {
    ['fCharName','fCharDept','fMindset','fSituation','fMission','fPersona'].forEach(f => document.getElementById(f).value = '');
    document.getElementById('fRoleLevel').value  = '';
    document.getElementById('fSelectable').value = '1';
  }
  document.getElementById('charModal').classList.remove('hidden');
}

async function saveChar(e) {
  e.preventDefault();
  const id         = document.getElementById('charId').value;
  const scenarioId = document.getElementById('charScenarioId').value;
  const body = {
    name:           document.getElementById('fCharName').value.trim(),
    department:     document.getElementById('fCharDept').value.trim(),
    role_level:     document.getElementById('fRoleLevel').value,
    is_selectable:  document.getElementById('fSelectable').value === '1',
    core_mindset:   document.getElementById('fMindset').value.trim(),
    situation:      document.getElementById('fSituation').value.trim(),
    mission:        document.getElementById('fMission').value.trim(),
    persona_prompt: document.getElementById('fPersona').value.trim()
  };
  try {
    if (id) await api('PUT',  `/api/admin/scenarios/${scenarioId}/characters/${id}`, body);
    else    await api('POST', `/api/admin/scenarios/${scenarioId}/characters`, body);
    document.getElementById('charModal').classList.add('hidden');
    loadChars(scenarioId);
  } catch (err) { alert('저장 실패: ' + err.message); }
}

async function deleteChar(id, scenarioId, name) {
  if (!confirm(`"${name}" 캐릭터를 삭제하시겠습니까?`)) return;
  try { await api('DELETE', `/api/admin/scenarios/${scenarioId}/characters/${id}`); loadChars(scenarioId); }
  catch (err) { alert('삭제 실패: ' + err.message); }
}

/* ── 통계 ── */
async function loadStats() {
  try {
    const data = await api('GET', '/api/admin/stats');
    document.getElementById('statSessions').textContent = data.total_sessions || 0;
    document.getElementById('statEvals').textContent    = data.total_evals || 0;
    document.getElementById('statAvg').textContent      = data.avg_score ? data.avg_score.toFixed(1) : '—';
  } catch { /* 데이터 없음 */ }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
