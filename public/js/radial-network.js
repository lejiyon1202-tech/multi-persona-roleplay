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
  '상사':     'hierarchy',
  '간접 상사': 'hierarchy',
  '경영진':   'hierarchy',
  '동료':     'colleague',
  '선배':     'colleague',
  '갈등':     'conflict',
  '간접영향': 'indirect',
  '간접 관리': 'indirect',
  '간접 연관': 'indirect',
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

/* ── A안: 위계 기반 유기적 비대칭 배치 ── */

/* 위계별 기본 반지름 */
const ORGANIC_R = {
  executive: RADIAL_R + 20,
  manager:   RADIAL_R,
  lead:      RADIAL_R,
  member:    RADIAL_R - 15,
};

/* 관계 강도별 반지름 미세 조정 */
const RELATION_R_FINE = {
  '갈등':     -20,
  '상위':      -5,
  '부하':      -5,
  '동료':        0,
  '간접영향': +15,
};

/* peer → center 방향 관계 타입 추출 */
function _peerRelType(peer, center) {
  const raw = peer.learner_detail;
  if (!raw) return null;
  const ld = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const rels = ld?.relationships_structured;
  if (!Array.isArray(rels)) return null;
  return rels.find(r => r.target_name === center.name)?.type || null;
}

/* 위계 기반 유기적 좌표 계산 */
function _peerCoordsOrganic(peers, center) {
  const bins = { executive: [], manager: [], lead: [], member: [] };
  peers.forEach((p, idx) => {
    const role = ROLE_LAYER_CLASS[p.role_level] || 'member';
    (bins[role] || bins.member).push({ p, idx });
  });

  const result = new Array(peers.length);

  const place = (group, centerDeg, spreadDeg, baseR) => {
    group.forEach(({ p, idx }, i) => {
      const n = group.length;
      const deg = centerDeg + (i - (n - 1) / 2) * spreadDeg;
      const ang = deg * Math.PI / 180;
      const fine = RELATION_R_FINE[_peerRelType(p, center)] ?? 0;
      result[idx] = {
        x: RADIAL_CX + (baseR + fine) * Math.cos(ang),
        y: RADIAL_CY + (baseR + fine) * Math.sin(ang),
      };
    });
  };

  /* 상위리더 → 위 12시 (−90°), 2명이면 ±25° */
  place(bins.executive, -90, 50, ORGANIC_R.executive);

  /* 파트장·동료 → 좌(−150°)∼우(−30°) 균등 분산 */
  const sideGroup = [...bins.manager, ...bins.lead];
  if (sideGroup.length > 0) {
    const step = sideGroup.length > 1 ? 120 / (sideGroup.length - 1) : 0;
    sideGroup.forEach(({ p, idx }, i) => {
      const deg = -150 + i * step;
      const ang = deg * Math.PI / 180;
      const role = ROLE_LAYER_CLASS[p.role_level] || 'member';
      const fine = RELATION_R_FINE[_peerRelType(p, center)] ?? 0;
      result[idx] = {
        x: RADIAL_CX + (ORGANIC_R[role] + fine) * Math.cos(ang),
        y: RADIAL_CY + (ORGANIC_R[role] + fine) * Math.sin(ang),
      };
    });
  }

  /* 부서원 → 아래 6시 (+90°), 2명이면 ±25° */
  place(bins.member, 90, 50, ORGANIC_R.member);

  return result;
}

/* relationships_structured → 중복 제거 관계 배열 */
function _parseRelations(chars) {
  const idByName = new Map(chars.map(c => [c.name, c.id]));

  /* target_name이 축약형일 때 전체 이름으로 폴백 매칭
     1순위: 정확 일치
     2순위: startsWith 양방향
     3순위: 첫 토큰(공백 기준) 으로 시작하는 이름이 DB에 단 1개일 때만 매칭 (오매칭 방지) */
  function _resolveId(targetName) {
    const exact = idByName.get(targetName);
    if (exact) return exact;
    for (const [name, id] of idByName) {
      if (name.startsWith(targetName) || targetName.startsWith(name)) return id;
    }
    const firstToken = targetName.split(' ')[0];
    const candidates = [...idByName.entries()].filter(([n]) => n.startsWith(firstToken));
    if (candidates.length === 1) return candidates[0][1];
    return undefined;
  }

  const seen = new Set();
  const out  = [];
  chars.forEach(c => {
    const raw = c.learner_detail;
    if (!raw) return;
    const ld = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const rels = ld?.relationships_structured;
    if (!Array.isArray(rels)) return;
    rels.forEach(r => {
      const tid = _resolveId(r.target_name);
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
  const peerCoords = _peerCoordsOrganic(peers, center);

  /* 좌표 맵 */
  const posMap = new Map();
  posMap.set(center.id, { x: RADIAL_CX, y: RADIAL_CY });
  peers.forEach((c, i) => posMap.set(c.id, peerCoords[i]));

  /* 렌더 순서: indirect → colleague → hierarchy → conflict (중요 선이 위에) */
  const TYPE_PRIORITY = { '간접영향': 0, '간접 관리': 0, '동료': 1, '선배': 1,
                          '상위': 2, '부하': 2, '상사': 2, '갈등': 3 };
  const allRelations = _parseRelations(chars);

  /* 동일 쌍에 복수 관계 → 우선순위 최고 타입 1개만 표시 (D안: hierarchy가 colleague를 가리는 문제 해소) */
  const pairBest = new Map();
  allRelations.forEach(r => {
    const key = [r.fromId, r.toId].sort((a, b) => a - b).join('-');
    const pri = TYPE_PRIORITY[r.type] ?? 0;
    if (!pairBest.has(key) || pri > (TYPE_PRIORITY[pairBest.get(key).type] ?? 0)) {
      pairBest.set(key, r);
    }
  });
  const relations  = [...pairBest.values()];
  const drawnPairs = new Set();

  /* 관계 데이터 없는 모든 쌍 → 간접 영향선 먼저 (뒤에 깔림) */
  const allIds = [center.id, ...peers.map(p => p.id)];
  for (let i = 0; i < allIds.length; i++) {
    for (let j = i + 1; j < allIds.length; j++) {
      const key = [allIds[i], allIds[j]].sort().join('-');
      if (!relations.some(r => [r.fromId, r.toId].sort().join('-') === key)) {
        const a = posMap.get(allIds[i]);
        const b = posMap.get(allIds[j]);
        if (a && b) svg.appendChild(_buildLine(a.x, a.y, b.x, b.y, '간접영향'));
      }
    }
  }

  /* 관계 있는 쌍 — 우선순위 순(indirect→colleague→hierarchy→conflict) */
  relations
    .slice()
    .sort((a, b) => (TYPE_PRIORITY[a.type] ?? 0) - (TYPE_PRIORITY[b.type] ?? 0))
    .forEach(({ fromId, toId, type, label }) => {
      const a = posMap.get(fromId);
      const b = posMap.get(toId);
      if (!a || !b) return;
      svg.appendChild(_buildLine(a.x, a.y, b.x, b.y, type));
      /* 라벨은 위계·갈등만 표시 — 동료·간접은 색으로만 구분 (빽빽함 방지) */
      if (RADIAL_LINE_CLASS[type] === 'hierarchy' || type === '갈등') {
        const lbl = _buildLabel(a.x, a.y, b.x, b.y, label);
        if (lbl) svg.appendChild(lbl);
      }
      drawnPairs.add([fromId, toId].sort().join('-'));
    });

  /* 노드 렌더 (중심 → 주변) */
  wrap.appendChild(_buildNode(center, true, { x: RADIAL_CX, y: RADIAL_CY }));
  peers.forEach((c, i) => wrap.appendChild(_buildNode(c, false, peerCoords[i])));

  mount.appendChild(wrap);
}
