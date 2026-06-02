/* ── org-tree.js: B안 조직도 트리 렌더 (원형 아바타 + 연결선 + 갈등 메타포) ── */
const ROLE_LAYER_ORDER = ['상위리더', '그룹장', '파트장', '부서원'];
const ROLE_LAYER_CLASS = {
  '상위리더': 'executive',
  '그룹장':   'manager',
  '파트장':   'lead',
  '부서원':   'member',
};

/* 시나리오별 레이어 간 갈등 메타포 */
const SCENE_CONFLICT = {
  1: { top: '상위리더', bot: '그룹장', topIcon: '↓', topLabel: 'AI 도입 압박',        botIcon: '↑', botLabel: '현장 저항' },
  2: { top: '상위리더', bot: '그룹장', topIcon: '↓', topLabel: 'KPI D-14 압박',        botIcon: '↑', botLabel: '번아웃 임계점' },
  4: { top: '그룹장',   bot: '파트장', topIcon: '⚡', topLabel: 'CDP D-30 치명적 오류', botIcon: '↑', botLabel: '현장 위기 보고' },
};

function renderOrgTree(chars, scenarioId) {
  const mount = document.getElementById('orgChart');
  if (!mount) return;

  const sid = parseInt(scenarioId, 10);
  const conflict = SCENE_CONFLICT[sid] || null;

  const byLayer = {};
  ROLE_LAYER_ORDER.forEach(r => { byLayer[r] = []; });
  chars.forEach(c => {
    const r = c.role_level;
    (byLayer[r] ? byLayer[r] : byLayer['부서원']).push(c);
  });

  mount.innerHTML = '';

  let prevPopulated = null;
  ROLE_LAYER_ORDER.forEach((role, idx) => {
    if (!byLayer[role].length) return;

    if (prevPopulated !== null) {
      const isConflict = conflict && conflict.top === prevPopulated && conflict.bot === role;
      mount.appendChild(buildConnector(isConflict ? conflict : null));
    }

    const level = document.createElement('div');
    level.className = `org-level org-level--${ROLE_LAYER_CLASS[role]}`;
    level.setAttribute('aria-level', String(idx + 1));

    const nodes = document.createElement('div');
    nodes.className = 'org-nodes';
    byLayer[role].forEach(c => nodes.appendChild(buildOrgNodeEl(c)));
    level.appendChild(nodes);
    mount.appendChild(level);
    prevPopulated = role;
  });
}

function buildConnector(conflictData) {
  const conn = document.createElement('div');
  conn.setAttribute('aria-hidden', 'true');
  if (!conflictData) {
    conn.className = 'org-connector';
    return conn;
  }
  conn.className = 'org-connector org-connector--conflict';
  const icon = document.createElement('div');
  icon.className = 'org-conflict-icon';
  const down = document.createElement('span');
  down.className = 'conflict-label';
  down.textContent = `${conflictData.topIcon} ${conflictData.topLabel}`;
  const vs = document.createElement('span');
  vs.className = 'conflict-vs';
  vs.setAttribute('aria-hidden', 'true');
  vs.textContent = 'VS';
  const up = document.createElement('span');
  up.className = 'conflict-label';
  up.textContent = `${conflictData.botIcon} ${conflictData.botLabel}`;
  icon.appendChild(down);
  icon.appendChild(vs);
  icon.appendChild(up);
  conn.appendChild(icon);
  return conn;
}

function buildOrgNodeEl(c) {
  const illustId = ROLE_LAYER_CLASS[c.role_level] || 'member';
  const node = document.createElement('div');
  node.className = `org-node role-${illustId}`;
  node.dataset.illust = illustId;
  node.dataset.charId = c.id;
  node.setAttribute('role', 'treeitem');
  node.setAttribute('tabindex', '0');
  node.setAttribute('aria-label', `${c.name} — 클릭해서 이 역할 맡기`);

  const illust = document.createElement('div');
  illust.className = 'org-illust';
  illust.setAttribute('aria-hidden', 'true');

  const nameEl = document.createElement('p');
  nameEl.className = 'org-node-name';
  nameEl.textContent = c.name;

  const deptEl = document.createElement('span');
  deptEl.className = 'org-node-dept';
  deptEl.textContent = c.role_level;

  node.appendChild(illust);
  node.appendChild(nameEl);
  node.appendChild(deptEl);

  node.addEventListener('click', () => openModal(c.id));
  node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(c.id); });
  return node;
}
