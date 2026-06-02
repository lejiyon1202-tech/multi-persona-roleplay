/* ── org-tree.js: B안 조직도 트리 렌더 (SVG 인물 + 관계 라벨 연결선 + 갈등 메타포) ── */

/* 역할별 SVG 인물 일러스트 (CC0 자체 제작) */
const SVG_ILLUST = {
  executive: `<svg viewBox="0 0 80 110" aria-hidden="true"><circle cx="40" cy="26" r="19" fill="rgba(255,255,255,0.92)"/><circle cx="33" cy="22" r="2.5" fill="#1C1917" opacity="0.75"/><circle cx="47" cy="22" r="2.5" fill="#1C1917" opacity="0.75"/><path d="M33 33 Q40 40 47 33" stroke="#1C1917" fill="none" stroke-width="2" stroke-linecap="round" opacity="0.7"/><path d="M40 45 L38 54 L40 51 L42 54 Z" fill="rgba(255,255,255,0.8)"/><ellipse cx="40" cy="82" rx="24" ry="22" fill="rgba(255,255,255,0.88)"/><line x1="40" y1="55" x2="40" y2="64" stroke="rgba(255,255,255,0.7)" stroke-width="2"/></svg>`,
  manager: `<svg viewBox="0 0 80 110" aria-hidden="true"><circle cx="40" cy="26" r="19" fill="rgba(255,255,255,0.92)"/><circle cx="33" cy="22" r="2.5" fill="#1C1917" opacity="0.75"/><circle cx="47" cy="22" r="2.5" fill="#1C1917" opacity="0.75"/><path d="M32 32 Q40 40 48 32" stroke="#1C1917" fill="none" stroke-width="2.5" stroke-linecap="round" opacity="0.75"/><ellipse cx="40" cy="82" rx="24" ry="22" fill="rgba(255,255,255,0.88)"/></svg>`,
  lead: `<svg viewBox="0 0 80 110" aria-hidden="true"><circle cx="40" cy="26" r="19" fill="rgba(255,255,255,0.92)"/><circle cx="33" cy="22" r="2.5" fill="#1C1917" opacity="0.75"/><circle cx="47" cy="22" r="2.5" fill="#1C1917" opacity="0.75"/><path d="M33 32 Q40 38 47 32" stroke="#1C1917" fill="none" stroke-width="1.8" stroke-linecap="round" opacity="0.65"/><ellipse cx="40" cy="82" rx="24" ry="22" fill="rgba(255,255,255,0.88)"/><line x1="26" y1="70" x2="18" y2="82" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  member: `<svg viewBox="0 0 80 110" aria-hidden="true"><circle cx="40" cy="26" r="19" fill="rgba(255,255,255,0.92)"/><circle cx="33" cy="22" r="2.5" fill="#1C1917" opacity="0.75"/><circle cx="47" cy="22" r="2.5" fill="#1C1917" opacity="0.75"/><path d="M34 32 Q40 36 46 32" stroke="#1C1917" fill="none" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/><ellipse cx="40" cy="82" rx="24" ry="22" fill="rgba(255,255,255,0.88)"/></svg>`,
};

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

/* relationships_structured 기반 레이어 간 관계 라벨 추출 */
function getLayerRelLabel(topChars, botChars) {
  const botNames = new Set(botChars.map(c => c.name));
  for (const c of topChars) {
    const raw = c.learner_detail;
    if (!raw) continue;
    const ld = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const rels = ld?.relationships_structured;
    if (!Array.isArray(rels)) continue;
    if (rels.some(r => r.type === '부하' && botNames.has(r.target_name))) {
      return { topLabel: '직속 보고 라인 ↓', botLabel: '↑ 현장 보고' };
    }
  }
  return null;
}

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
      const relLabel   = !isConflict ? getLayerRelLabel(byLayer[prevPopulated], byLayer[role]) : null;
      mount.appendChild(buildConnector(isConflict ? conflict : null, relLabel));
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

function buildConnector(conflictData, relLabel) {
  const conn = document.createElement('div');
  conn.setAttribute('aria-hidden', 'true');

  if (conflictData) {
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

  if (relLabel) {
    conn.className = 'org-connector org-connector--relation';
    const icon = document.createElement('div');
    icon.className = 'org-rel-icon';
    const topSpan = document.createElement('span');
    topSpan.className = 'rel-label';
    topSpan.textContent = relLabel.topLabel;
    const botSpan = document.createElement('span');
    botSpan.className = 'rel-label';
    botSpan.textContent = relLabel.botLabel;
    icon.appendChild(topSpan);
    icon.appendChild(botSpan);
    conn.appendChild(icon);
    return conn;
  }

  conn.className = 'org-connector';
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
  illust.innerHTML = SVG_ILLUST[illustId] || SVG_ILLUST.member;

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
