const ROLE_COLORS = {
  executive: '#312E2B', manager: '#1B3250',
  lead: '#1A3D30', member: '#6B3B1D'
};
const ROLE_MAP = { '상위리더': 'executive', '그룹장': 'manager', '파트장': 'lead', '부서원': 'member' };

/* 근거: tags = context_description·learner_mission 핵심 역량 키워드 추출
         duration = 캐릭터별 권장 5~7턴 × 약 2분 + 선택·준비 시간
         difficulty = emotion_stages 분기 수 (캐릭터 수 × 단계 수·임원급 위계 복잡도) */
const SCENARIO_META = {
  /* Case 1: 경영진 압박↔현장 저항 갈등구조, 6캐릭터 3계층, emotion_stages 3단계 × 6 = 18분기 */
  1: { tags: ['#변화관리', '#팀리더십', '#갈등해소'], duration: '15~20분', difficulty: 3 },
  /* Case 2: D-14 KPI 보고 시간압박 + 번아웃 복합, Case 1 동일 구조 + 긴박감 가중 */
  2: { tags: ['#성과관리', '#번아웃예방', '#팀리더십'], duration: '15~20분', difficulty: 3 },
  /* Case 3: CCO·본부장·팀장·수석 4계층, 147억 투자 D-30 위기, 임원급 의사결정 고난도 */
  4: { tags: ['#위기관리', '#의사결정', '#이해관계자소통'], duration: '20~25분', difficulty: 4 },
};


/* ── 시나리오 로드 ── */
async function loadScenarios() {
  const grid = document.getElementById('scenarioGrid');
  try {
    const res = await fetch('/api/scenarios');
    const data = await res.json();
    if (!data.scenarios || data.scenarios.length === 0) {
      grid.innerHTML = `
        <div class="empty-state grid-span-full">
          <div class="empty-state-icon">📋</div>
          <p class="empty-state-title">등록된 시나리오가 없습니다</p>
          <p class="empty-state-desc">관리자 페이지에서 시나리오를 추가해 주세요.</p>
        </div>`;
      return;
    }
    grid.innerHTML = data.scenarios.map((s, i) => renderScenarioCard(s, i)).join('');
    bindScenarioEvents();
    document.dispatchEvent(new Event('scenariosLoaded'));
  } catch (err) {
    grid.innerHTML = renderDemoCards();
    bindScenarioEvents();
    document.dispatchEvent(new Event('scenariosLoaded'));
  }
}

function renderScenarioCard(scenario, idx) {
  const caseNum = String(idx + 1).padStart(2, '0');
  const charCount = scenario.character_count || 6;
  const meta = SCENARIO_META[scenario.id] || { tags: [], duration: '15~20분', difficulty: 3 };
  const tagsHtml = meta.tags.map(t => `<span class="scenario-tag">${escHtml(t)}</span>`).join('');
  const stars = '★'.repeat(meta.difficulty) + '☆'.repeat(5 - meta.difficulty);
  return `
    <div class="scenario-card" data-scenario-id="${scenario.id}" tabindex="0" role="button"
         aria-label="${scenario.title} 시나리오 선택">
      <div class="scenario-card-header">
        <span class="case-badge">CASE ${caseNum}</span>
        <span class="char-count">
          등장인물 ${charCount}명
          <span class="char-count-dot">
            ${Array.from({length: Math.min(charCount,6)}, (_,j) => {
              const rks = ['executive','manager','lead','member'];
              return `<span class="avatar-bg ${rks[j % 4]}"></span>`;
            }).join('')}
          </span>
        </span>
      </div>
      <div>
        <h2 class="scenario-title">${escHtml(scenario.title)}</h2>
        ${scenario.case_name ? `<p class="scenario-subtitle">${escHtml(scenario.case_name)}</p>` : ''}
      </div>
      <p class="scenario-desc">${escHtml(scenario.context_description || '').slice(0, 100)}${(scenario.context_description || '').length > 100 ? '...' : ''}</p>
      <div class="scenario-tags">${tagsHtml}</div>
      <div class="scenario-meta-row">
        <span class="scenario-duration">⏱ ${escHtml(meta.duration)}</span>
        <span class="scenario-difficulty" data-level="${meta.difficulty}">${stars}</span>
      </div>
      <div class="scenario-card-footer">
        <button class="scenario-start-btn" data-scenario-id="${scenario.id}">
          시작하기
          <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>`;
}

function renderDemoCards() {
  const demos = [
    { id: 1, title: 'AI 전환 압박 — 팀원 저항과 신뢰 회복', case_name: 'Case Study 01', context_description: 'AI혁신센터 내부에서 경영진 압박과 팀원 저항이 충돌하는 상황입니다. 어떤 입장에서 이 갈등을 바라보시겠습니까?', learner_role: '자유 선택', character_count: 6 },
    { id: 2, title: 'AI 성과 보고 D-14 — 경영진 압박과 현장 번아웃', case_name: 'Case Study 02', context_description: 'AI 성과 보고 2주 전, 경영진 KPI 압박과 현장 번아웃이 극에 달한 상황입니다. 각자의 입장에서 이 간극을 좁혀가세요.', learner_role: '자유 선택', character_count: 6 },
    { id: 4, title: 'CDP 전환 위기 — 30일의 선택', case_name: 'Case Study 03', context_description: 'DX통합본부 CDP 전환 D-30에 치명적 오류가 발견된 위기 상황입니다. 선택한 캐릭터의 입장에서 위기를 분석하고 해결책을 이끌어내세요.', learner_role: '자유 선택', character_count: 6 },
  ];
  return demos.map((s, i) => renderScenarioCard(s, i)).join('');
}

function bindScenarioEvents() {
  document.querySelectorAll('.scenario-card').forEach(card => {
    card.addEventListener('click', () => goToCharacterSelect(card.dataset.scenarioId));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') goToCharacterSelect(card.dataset.scenarioId); });
  });
  document.querySelectorAll('.scenario-start-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      goToCharacterSelect(btn.dataset.scenarioId);
    });
  });
}

function goToCharacterSelect(scenarioId) {
  window.location.href = `character-select.html?scenario_id=${scenarioId}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadScenarios();

