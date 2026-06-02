/* ── radial-network.js: 방사형 네트워크 그래프 (ProcessOn 스타일) ── */
/* SVG_ILLUST, ROLE_LAYER_CLASS 는 org-tree.js 전역 공유 */

const RADIAL_W  = 560;
const RADIAL_H  = 480;
const RADIAL_CX = RADIAL_W / 2;
const RADIAL_CY = RADIAL_H / 2;
const RADIAL_R  = 185;

/* 시나리오별 중심 역할 (갈등 핵심 인물) */
const RADIAL_CENTER_ROLE = { 1: '그룹장', 2: '그룹장', 4: '그룹장' };

/* relationships_structured type → CSS modifier */
const RADIAL_LINE_CLASS = {
  '상위':     'hierarchy',
  '부하':     'hierarchy',
  '동료':     'colleague',
  '갈등':     'conflict',
  '간접영향': 'indirect',
};

/* relationships_structured type → 짧은 라벨 */
const RADIAL_LINE_LABEL = {
  '상위':     '상위',
  '부하':     '보고',
  '동료':     '동료',
  '갈등':     '갈등',
  '간접영향': '간접',
};

/* ── 헬퍼 ── */

function _svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function _pickCenter(chars, scenarioId) {
  const role = RADIAL_CENTER_ROLE[parseInt(scenarioId, 10)] || '그룹장';
  return chars.find(c => c.role_level === role) || chars[0];
}

/* 주변 n개 좌표 (−90°부터 균등 분할) */
function _peerCoords(n) {
  const out = [];
  const start = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = start + (2 * Math.PI / n) * i;
    out.push({ x: RADIAL_CX + RADIAL_R * Math.cos(a), y: RADIAL_CY + RADIAL_R * Math.sin(a) });
  }
  return out;
}

/* relationships_structured → 중복 제거 관계 배열 */
function _parseRelations(chars) {
  const idByName = new Map(chars.map(c => [c.name, c.id]));
  const seen = new Set();
  const out  = [];
  chars.forEach(c => {
    const raw = c.learner_detail;
    if (!raw) return;
    const ld = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const rels = ld?.relationships_structured;
    if (!Array.isArray(rels)) return;
    rels.forEach(r => {
      const tid = idByName.get(r.target_name);
      if (!tid) return;
      const dedupeKey = [c.id, tid].sort((a, b) => a - b).join('-') + ':' + r.type;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      out.push({ fromId: c.id, toId: tid, type: r.type,
                 label: RADIAL_LINE_LABEL[r.type] || '' });
    });
  });
  return out;
}

/* SVG 관계선 */
function _buildLine(x1, y1, x2, y2, type) {
  const mod = RADIAL_LINE_CLASS[type] || 'indirect';
  return _svgEl('line', {
    x1: x1.toFixed(1), y1: y1.toFixed(1),
    x2: x2.toFixed(1), y2: y2.toFixed(1),
    class: `org-radial-line org-radial-line--${mod}`,
    'data-type': type,
  });
}

/* SVG 라벨 */
function _buildLabel(x1, y1, x2, y2, text) {
  if (!text) return null;
  const el = _svgEl('text', {
    x: ((x1 + x2) / 2).toFixed(1),
    y: ((y1 + y2) / 2 - 5).toFixed(1),
    class: 'org-radial-label-el',
  });
  el.textContent = text;
  return el;
}

/* 캐릭터 노드 DOM */
function _buildNode(c, isCenter, pos) {
  const illustId = ROLE_LAYER_CLASS[c.role_level] || 'member';
  const node = document.createElement('div');
  node.className = isCenter
    ? `org-node role-${illustId} is-center`
    : `org-node role-${illustId}`;
  node.dataset.charId = c.id;
  node.setAttribute('role', 'treeitem');
  node.setAttribute('tabindex', '0');
  node.setAttribute('aria-label', `${c.name} — 클릭해서 이 역할 맡기`);
  /* % 기반 — SVG viewBox 스케일과 항상 일치 (CSP 무관) */
  node.style.left = `${(pos.x / RADIAL_W * 100).toFixed(2)}%`;
  node.style.top  = `${(pos.y / RADIAL_H * 100).toFixed(2)}%`;

  const illust = document.createElement('div');
  illust.className = 'org-illust';
  illust.setAttribute('aria-hidden', 'true');

  const img = document.createElement('img');
  img.className = 'org-avatar-img';
  img.alt = '';
  img.src = c.avatar_url || `/avatars/char-${c.id}.jpg`;
  img.onerror = () => { illust.innerHTML = SVG_ILLUST[illustId] || SVG_ILLUST.member; };
  illust.appendChild(img);

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

/* ── 메인 렌더 ── */

function renderRadialNetwork(chars, scenarioId) {
  const mount = document.getElementById('orgChart');
  if (!mount) return;
  mount.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'org-radial-wrap';
  wrap.setAttribute('role', 'tree');
  wrap.setAttribute('aria-label', '등장인물 관계도');

  /* SVG 오버레이 */
  const svg = _svgEl('svg', {
    class: 'org-radial-svg',
    viewBox: `0 0 ${RADIAL_W} ${RADIAL_H}`,
    preserveAspectRatio: 'xMidYMid meet',
    'aria-hidden': 'true',
  });
  wrap.appendChild(svg);

  /* 중심·주변 분리 */
  const center     = _pickCenter(chars, scenarioId);
  const peers      = chars.filter(c => c.id !== center.id);
  const peerCoords = _peerCoords(peers.length);

  /* 좌표 맵 */
  const posMap = new Map();
  posMap.set(center.id, { x: RADIAL_CX, y: RADIAL_CY });
  peers.forEach((c, i) => posMap.set(c.id, peerCoords[i]));

  /* relationships_structured 관계선 (주변↔주변은 갈등만·엉킴 방지) */
  const relations  = _parseRelations(chars);
  const drawnPairs = new Set();
  relations.forEach(({ fromId, toId, type, label }) => {
    const a = posMap.get(fromId);
    const b = posMap.get(toId);
    if (!a || !b) return;
    const involveCenter = fromId === center.id || toId === center.id;
    if (!involveCenter && type !== '갈등') return;
    svg.appendChild(_buildLine(a.x, a.y, b.x, b.y, type));
    const lbl = _buildLabel(a.x, a.y, b.x, b.y, label);
    if (lbl) svg.appendChild(lbl);
    drawnPairs.add([fromId, toId].sort().join('-'));
  });

  /* 관계 없는 중심↔주변 → 기본 간접선 */
  peers.forEach(pc => {
    const key = [center.id, pc.id].sort().join('-');
    if (!drawnPairs.has(key)) {
      const a = posMap.get(center.id);
      const b = posMap.get(pc.id);
      svg.appendChild(_buildLine(a.x, a.y, b.x, b.y, '간접영향'));
    }
  });

  /* 노드 렌더 (중심 → 주변) */
  wrap.appendChild(_buildNode(center, true, { x: RADIAL_CX, y: RADIAL_CY }));
  peers.forEach((c, i) => wrap.appendChild(_buildNode(c, false, peerCoords[i])));

  mount.appendChild(wrap);
}
