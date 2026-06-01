const ROLE_COLORS = {
  executive: '#312e81', manager: '#1e3a8a',
  lead: '#134e4a', member: '#78350f'
};
const ROLE_MAP = { '상위리더': 'executive', '그룹장': 'manager', '파트장': 'lead', '부서원': 'member' };

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

/* ── 시나리오 로드 ── */
async function loadScenarios() {
  const grid = document.getElementById('scenarioGrid');
  try {
    const res = await fetch('/api/scenarios');
    const data = await res.json();
    if (!data.scenarios || data.scenarios.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📋</div>
          <p class="empty-state-title">등록된 시나리오가 없습니다</p>
          <p class="empty-state-desc">관리자 페이지에서 시나리오를 추가해 주세요.</p>
        </div>`;
      return;
    }
    grid.innerHTML = data.scenarios.map((s, i) => renderScenarioCard(s, i)).join('');
    bindScenarioEvents();
  } catch (err) {
    grid.innerHTML = renderDemoCards();
    bindScenarioEvents();
  }
}

function renderScenarioCard(scenario, idx) {
  const caseNum = String(idx + 1).padStart(2, '0');
  const charCount = scenario.character_count || 6;
  return `
    <div class="scenario-card" data-scenario-id="${scenario.id}" tabindex="0" role="button"
         aria-label="${scenario.title} 시나리오 선택">
      <div class="scenario-card-header">
        <span class="case-badge">CASE ${caseNum}</span>
        <span class="char-count">
          등장인물 ${charCount}명
          <span class="char-count-dot">
            ${Array.from({length: Math.min(charCount,6)}, (_,j) =>
              `<span style="background:${Object.values(ROLE_COLORS)[j % 4]}"></span>`
            ).join('')}
          </span>
        </span>
      </div>
      <div>
        <h2 class="scenario-title">${escHtml(scenario.title)}</h2>
        ${scenario.case_name ? `<p class="scenario-subtitle">${escHtml(scenario.case_name)}</p>` : ''}
      </div>
      <p class="scenario-desc">${escHtml(scenario.context_description || '').slice(0, 100)}${(scenario.context_description || '').length > 100 ? '...' : ''}</p>
      <div class="scenario-card-footer">
        <span class="scenario-meta">학습자 역할: ${escHtml(scenario.learner_role || '그룹장')}</span>
        <button class="scenario-start-btn" data-scenario-id="${scenario.id}">
          시작하기
          <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>`;
}

function renderDemoCards() {
  const demos = [
    { id: 1, title: '조직 방향성 정렬', case_name: 'Case Study 01', context_description: 'AI센터 그룹장으로서 팀원들과 외부 솔루션 도입에 대한 방향성을 정렬해야 합니다. 다양한 이해관계자들을 설득하는 리더십을 연습합니다.', learner_role: '김센터 그룹장', character_count: 6 },
    { id: 2, title: '성과 압박 상황', case_name: 'Case Study 02', context_description: '성과 달성을 위한 압박 상황에서 팀원들과 소통하며 목표를 재정렬해야 합니다. 감정 조율과 합리적 의사소통 역량을 기릅니다.', learner_role: '김센터 그룹장', character_count: 6 }
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
