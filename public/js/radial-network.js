/* ── radial-network.js: v5 양방향 관계망 (실데이터·정보 가독성 강화) ──
   ROLE_LAYER_CLASS·SVG_ILLUST(org-tree.js), openModal(character-select.js) 전역 공유.
   노출 범위: 이름·직급·역할·공개 직무·공개 조직 관계 구도까지만.
   inner_conflict·core_mindset·situation·mission·emotion 등 학습 정보 바인딩 0(절대 규칙). */

const RN_VB = 760, RN_C = 380, RN_R = 760 * 0.345, RN_START = -90;
const RN_COLOR = { hier: '#64748B', conf: '#EF4444', peer: '#0D9488' };
const RN_WIDTH = { hier: 2.5, conf: 3.5, peer: 2.5 };
const RN_TYPE_TAG = { hier: '보고', conf: '갈등', peer: '협력' };

/* role_level → v5 cls */
const RN_CLS = { '상위리더': 'exec', '그룹장': 'mgr', '파트장': 'lead', '부서원': 'mem' };

/* relationships_structured type → v5 type (없으면 생략·간접 등 부차) */
const RN_REL_TYPE = {
  '상위': 'hier', '상사': 'hier', '부하': 'hier', '간접 상사': 'hier',
  '경영진': 'hier', '간접 관리': 'hier',
  '동료': 'peer', '선배': 'peer',
  '갈등': 'conf',
};
/* 공개 조직 구도 텍스트 (숨은 심리·감정 0) */
const RN_DESC = {
  '상위': '상위 리더 · 보고함', '상사': '직속 상사 · 보고함', '간접 상사': '간접 상사',
  '경영진': '경영진 · 보고함', '간접 관리': '간접 관리 받음',
  '부하': '직속 부하 · 보고를 받음',
  '동료': '동료 · 상호 협력', '선배': '선배 · 상호 협력',
  '갈등': '관점을 둘러싼 갈등',
};

let RN_ALL = {}, RN_REL = [], RN_POS = {}, RN_NODEREL = {}, RN_centerId = null;
let RN_stage, RN_svg, RN_panelEmpty, RN_panelBody;

function rnEsc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* target_name → 캐릭터 매칭 (정확 → 축약 폴백) */
function rnResolve(chars, name) {
  let c = chars.find(x => x.name === name);
  if (c) return c;
  const cs = chars.filter(x => x.name.startsWith(name) || name.startsWith(x.name));
  if (cs.length === 1) return cs[0];
  const ft = name.split(' ')[0];
  const tc = chars.filter(x => x.name.startsWith(ft));
  return tc.length === 1 ? tc[0] : null;
}

/* 공개 직무 한 줄 (department 기반·core_mindset/situation 금지) */
function rnJob(c) {
  if (c.department && c.role_level) return `${c.department} · ${c.role_level}`;
  return c.department || c.role_level || '';
}

/* 실데이터 → REL (쌍별 복수 관계·양방향 통합) */
function rnBuildRel(chars) {
  const pairMap = new Map();
  chars.forEach(c => {
    const rels = (c.learner_detail || {}).relationships_structured;
    if (!Array.isArray(rels)) return;
    rels.forEach(r => {
      const t = rnResolve(chars, r.target_name);
      if (!t || t.id === c.id) return;
      const vtype = RN_REL_TYPE[r.type];
      if (!vtype) return;
      const key = [c.id, t.id].sort((a, b) => a - b).join('-');
      if (!pairMap.has(key)) pairMap.set(key, { idA: Math.min(c.id, t.id), idB: Math.max(c.id, t.id), byType: {} });
      const pm = pairMap.get(key);
      pm.byType[vtype] = pm.byType[vtype] || {};
      pm.byType[vtype][c.id] = RN_DESC[r.type] || r.type;
    });
  });

  const rel = [];
  pairMap.forEach(pm => {
    const types = Object.keys(pm.byType);
    const complex = types.length > 1;
    const cA = RN_ALL[pm.idA], cB = RN_ALL[pm.idB];
    types.forEach((vtype, ti) => {
      const bt = pm.byType[vtype];
      let descA = bt[pm.idA], descB = bt[pm.idB];
      if (vtype === 'hier') {
        const isSuperior = d => /상사|상위|경영진/.test(d || '');
        if (!descA && descB) descA = isSuperior(descB) ? RN_DESC['부하'] : RN_DESC['상사'];
        if (!descB && descA) descB = isSuperior(descA) ? RN_DESC['부하'] : RN_DESC['상사'];
      } else {
        descA = descA || descB; descB = descB || descA;
      }
      const isKey = vtype === 'conf' || complex;
      const baseCurve = vtype === 'conf' ? 34 : vtype === 'peer' ? 36 : 16;
      rel.push({
        a: pm.idA, b: pm.idB, type: vtype, key: isKey,
        curve: baseCurve * (ti % 2 === 0 ? 1 : -1),
        label: vtype === 'conf' ? '갈등' : (complex && vtype === 'peer' ? '협력' : null),
        relA: { w: cB ? cB.name : '', d: descA || '' },
        relB: { w: cA ? cA.name : '', d: descB || '' },
      });
    });
  });
  return rel;
}

function rnPolar(deg) { const r = deg * Math.PI / 180; return { x: RN_C + RN_R * Math.cos(r), y: RN_C + RN_R * Math.sin(r) }; }
const rnPct = v => (v / RN_VB * 100);

function rnQuad(p1, p2, curve) {
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * curve, cy = my + (dx / len) * curve;
  return { d: `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`, cx, cy };
}
function rnArrow(tip, ctrl, color, w) {
  const ang = Math.atan2(ctrl.y - tip.y, ctrl.x - tip.x);
  const L = 12, sp = 0.42;
  const x1 = tip.x + L * Math.cos(ang + sp), y1 = tip.y + L * Math.sin(ang + sp);
  const x2 = tip.x + L * Math.cos(ang - sp), y2 = tip.y + L * Math.sin(ang - sp);
  return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function rnBuildEdges() {
  let html = '';
  RN_NODEREL = {};
  RN_REL.forEach((rel, i) => {
    const p1 = RN_POS[rel.a], p2 = RN_POS[rel.b];
    if (!p1 || !p2) return;
    const { d, cx, cy } = rnQuad(p1, p2, rel.curve);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.abs(rel.curve) * 1.3;
    const cls = rel.type === 'conf' ? 'e-conf' : rel.type === 'peer' ? 'e-peer' : 'e-hier';
    const flowCls = rel.type === 'conf' ? 'f-conf' : rel.type === 'peer' ? 'f-peer' : 'f-hier';
    const col = RN_COLOR[rel.type], w = RN_WIDTH[rel.type];
    const tag = `r${i}`;
    const promin = rel.key ? 'keyrel' : 'subtle';
    const weight = rel.key ? (rel.type === 'conf' ? 'key' : 'complex') : 'sub';
    rel._len = len; rel._delay = (0.55 + i * 0.09);
    html += `<path class="edge edge-draw ${cls} ${promin}" data-rel="${tag}" data-weight="${weight}" d="${d}"/>`;
    html += `<path class="flow ${flowCls} ${promin} dir-fwd" data-rel="${tag}" d="${d}"/>`;
    html += `<path class="flow ${flowCls} ${promin} dir-rev" data-rel="${tag}" d="${d}"/>`;
    html += `<g class="arrows ${promin}" data-rel="${tag}">${rnArrow(p1, { x: cx, y: cy }, col, w)}${rnArrow(p2, { x: cx, y: cy }, col, w)}</g>`;
    (RN_NODEREL[rel.a] = RN_NODEREL[rel.a] || []).push(i);
    (RN_NODEREL[rel.b] = RN_NODEREL[rel.b] || []).push(i);
    rel._mid = { x: cx, y: cy }; rel._tag = tag;
  });
  RN_svg.innerHTML = html;
  /* CSP 호환: --len·animation-delay는 innerHTML style="" 대신 JS CSSOM으로 설정 (style-src 'self' 위반 회피) */
  RN_REL.forEach(rel => {
    if (!rel._tag) return;
    const p = RN_svg.querySelector(`.edge-draw[data-rel="${rel._tag}"]`);
    if (p) { p.style.setProperty('--len', rel._len.toFixed(0)); p.style.animationDelay = rel._delay.toFixed(2) + 's'; }
  });
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) setTimeout(() => RN_svg.querySelectorAll('.flow').forEach(f => f.classList.add('on')), 1700);
}

function rnMakeNode(c, x, y, isCenter, delay) {
  const cls = RN_CLS[c.role_level] || 'mem';
  const el = document.createElement('div');
  el.className = `node ${cls}${isCenter ? ' center' : ''}`;
  el.dataset.node = c.id;
  el.style.left = rnPct(x) + '%';
  el.style.top = rnPct(y) + '%';
  el.style.animationDelay = delay + 's';
  const initial = (c.name || '?').trim().charAt(0);
  const job = rnJob(c);
  el.innerHTML = `${isCenter ? '<span class="me-flag">내 역할</span>' : ''}<div class="avatar">${rnEsc(initial)}</div><div class="n-name">${rnEsc(c.name)}</div><span class="n-badge">${rnEsc(c.role_level)}</span>`;
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${c.name} ${c.role_level}. ${job}. 관계 보기`);
  el.addEventListener('mouseenter', () => rnFocus(c.id));
  el.addEventListener('mouseleave', rnUnfocus);
  el.addEventListener('focus', () => rnFocus(c.id));
  el.addEventListener('blur', rnUnfocus);
  /* 게이트 3번: 탭(click)=패널(모바일/hover 없는 기기)·키보드 Enter/Space=패널. 상세 선택은 패널 버튼→openModal */
  el.addEventListener('click', () => rnFocus(c.id));
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rnFocus(c.id); } });
  return el;
}

function rnFocus(id) {
  if (!RN_stage) return;
  RN_stage.classList.add('focusing');
  const idxs = RN_NODEREL[id] || [];
  const active = new Set([id]);
  idxs.forEach(i => { active.add(RN_REL[i].a); active.add(RN_REL[i].b); });
  active.forEach(nid => { const n = RN_stage.querySelector(`.node[data-node="${nid}"]`); if (n) n.classList.add('active'); });
  idxs.forEach(i => {
    document.querySelectorAll(`[data-rel="${RN_REL[i]._tag}"]`).forEach(e => e.classList.add('active'));
    const chip = RN_stage.querySelector(`.rel-chip[data-rel="${RN_REL[i]._tag}"]`); if (chip) chip.classList.add('active');
  });
  rnPanel(id);
}
function rnUnfocus() {
  if (!RN_stage) return;
  RN_stage.classList.remove('focusing');
  RN_stage.querySelectorAll('.node.active').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.active').forEach(e => e.classList.remove('active'));
}

function rnPanel(id) {
  const c = RN_ALL[id];
  if (!c || !RN_panelBody) return;
  const idxs = RN_NODEREL[id] || [];
  let rows = '';
  idxs.forEach(i => {
    const rel = RN_REL[i];
    const mine = rel.a === id ? rel.relA : rel.relB;
    rows += `<div class="rel-row t-${rel.type}"><span class="tag">${RN_TYPE_TAG[rel.type]}</span><span class="who"><b>${rnEsc(mine.w)}</b><br><span>${rnEsc(mine.d)}</span></span></div>`;
  });
  const cls = RN_CLS[c.role_level] || 'mem';
  RN_panelBody.innerHTML = `<div class="pb-top"><div class="pb-av">${rnEsc((c.name || '?').charAt(0))}</div><div class="pb-id"><div class="pb-name">${rnEsc(c.name)}</div><div class="pb-meta"><span class="pb-rank">${rnEsc(c.role_level)}</span>${id === RN_centerId ? '<span class="pb-me">내 역할</span>' : ''}</div></div></div><div class="pb-sec"><h4>공개 직무</h4><div class="pb-job">${rnEsc(rnJob(c))}</div></div><div class="pb-sec"><h4>이 인물의 관계 요약</h4><div class="rel-list">${rows || '<div class="rel-row t-hier"><span class="who"><span>표시할 관계가 없습니다.</span></span></div>'}</div></div><button class="pb-pick" type="button">이 인물로 시작하기</button>`;
  const btn = RN_panelBody.querySelector('.pb-pick');
  if (btn) btn.addEventListener('click', () => { if (typeof openModal === 'function') openModal(id); });
  const m = { exec: ['--exec', '--exec-mid', '--exec-bg'], mgr: ['--mgr', '--mgr-mid', '--mgr-bg'], lead: ['--lead', '--lead-mid', '--lead-bg'], mem: ['--mem', '--mem-mid', '--mem-bg'] }[cls];
  RN_panelBody.style.setProperty('--p-accent', `var(${m[0]})`);
  RN_panelBody.style.setProperty('--p-mid', `var(${m[1]})`);
  RN_panelBody.style.setProperty('--p-bg', `var(${m[2]})`);
  if (RN_panelEmpty) RN_panelEmpty.style.display = 'none';
  RN_panelBody.classList.add('show');
}

function rnPlaceChips() {
  RN_REL.forEach(rel => {
    if (!rel.label || !rel._mid) return;
    const chip = document.createElement('div');
    chip.className = `rel-chip r-${rel.type} ${rel.key ? 'key' : 'minor'}`;
    chip.dataset.rel = rel._tag;
    chip.style.left = rnPct(rel._mid.x) + '%';
    chip.style.top = rnPct(rel._mid.y) + '%';
    chip.innerHTML = `<span class="arr">${rel.type === 'conf' ? '⇄' : '⇆'}</span>${rnEsc(rel.label)}`;
    RN_stage.appendChild(chip);
  });
}

/* 중심 = 시나리오 주역(그룹장·갈등 핵심) — 기존 RADIAL_CENTER_ROLE 정합 */
function rnPickCenter(chars) {
  return chars.find(c => c.role_level === '그룹장') || chars[0];
}

/* ── 진입점 (character-select.js 호출·시그니처 유지) ── */
function renderRadialNetwork(chars, scenarioId) {
  RN_stage = document.getElementById('stage') || document.getElementById('orgChart');
  RN_svg = document.getElementById('svg');
  RN_panelEmpty = document.getElementById('panelEmpty');
  RN_panelBody = document.getElementById('panelBody');
  if (!RN_stage || !RN_svg || !chars || !chars.length) return;

  RN_stage.querySelectorAll('.node, .rel-chip').forEach(e => e.remove());
  RN_svg.innerHTML = '';

  RN_ALL = {}; chars.forEach(c => RN_ALL[c.id] = c);
  RN_REL = rnBuildRel(chars);

  const center = rnPickCenter(chars);
  RN_centerId = center.id;
  const peers = chars.filter(c => c.id !== center.id);

  RN_POS = { [center.id]: { x: RN_C, y: RN_C } };
  peers.forEach((c, i) => { RN_POS[c.id] = rnPolar(RN_START + i * (360 / peers.length)); });

  rnBuildEdges();

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  RN_stage.appendChild(rnMakeNode(center, RN_C, RN_C, true, 0));
  peers.forEach((c, i) => RN_stage.appendChild(rnMakeNode(c, RN_POS[c.id].x, RN_POS[c.id].y, false, reduce ? 0 : 0.5 + i * 0.12)));
  rnPlaceChips();
}
