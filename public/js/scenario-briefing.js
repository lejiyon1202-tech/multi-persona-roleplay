const THEME_MAP = { 1: 'theme-ai', 2: 'theme-deadline', 4: 'theme-crisis' };
const BRIEFING_LABELS = {
  background:    { icon: '🏢', badge: '배경',    title: '상황 배경' },
  stakeholders:  { icon: '👥', badge: '인물관계', title: '등장인물 관계' },
  conflict:      { icon: '⚡', badge: '핵심 갈등', title: '핵심 갈등' },
  learning_goal: { icon: '🎯', badge: '학습 목표', title: '학습 목표' },
  before_start:  { icon: '📌', badge: '시작 전',  title: '시작 전 알아둘 것' },
};
const KEY_ORDER = ['background', 'stakeholders', 'conflict', 'learning_goal', 'before_start'];

const params     = new URLSearchParams(location.search);
const scenarioId = params.get('scenario_id') || '1';

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function loadBriefing() {
  try {
    const res = await fetch(`/api/scenarios/${scenarioId}`);
    if (!res.ok) throw new Error('시나리오 없음');
    const scenario = await res.json();

    // 히어로 정보
    const heroEl     = document.getElementById('briefingHero');
    const titleEl    = document.getElementById('heroTitle');
    const caseEl     = document.getElementById('heroCaseName');
    const subEl      = document.getElementById('heroSub');

    if (heroEl) {
      const theme = THEME_MAP[parseInt(scenarioId, 10)] || 'theme-ai';
      heroEl.classList.add(theme);
    }

    // 뒤로가기
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
    if (titleEl)  titleEl.textContent  = scenario.title || '';
    if (caseEl)   caseEl.textContent   = scenario.case_name || '';
    if (subEl)    subEl.textContent    = scenario.learner_role ? `학습자 역할: ${scenario.learner_role}` : '';

    // 브리핑 5요소 카드 렌더
    const grid = document.getElementById('briefingGrid');
    if (grid) {
      const briefing = typeof scenario.briefing === 'string'
        ? JSON.parse(scenario.briefing)
        : (scenario.briefing || {});

      grid.innerHTML = KEY_ORDER.map((key, idx) => {
        const meta = BRIEFING_LABELS[key];
        const text = briefing[key] || '';
        return `
          <div class="briefing-card${idx === 0 ? ' briefing-card--full' : ''}" data-key="${key}">
            <div class="briefing-card-inner">
              <div class="briefing-card-icon">${meta.icon}</div>
              <div class="briefing-card-title-wrap">
                <span class="briefing-card-badge">${escHtml(meta.badge)}</span>
                <h3 class="briefing-card-title">${escHtml(meta.title)}</h3>
              </div>
            </div>
            <p class="briefing-card-body">${escHtml(text)}</p>
          </div>`;
      }).join('');
    }

    // CTA 활성화
    const cta = document.getElementById('ctaBtn');
    if (cta) {
      cta.disabled = false;
      cta.addEventListener('click', () => {
        window.location.href = `character-select.html?scenario_id=${scenarioId}`;
      });
    }

  } catch (err) {
    console.error('[briefing]', err.message);
    const grid = document.getElementById('briefingGrid');
    if (grid) grid.innerHTML = '<p class="briefing-error">브리핑 정보를 불러올 수 없습니다.</p>';
    const cta = document.getElementById('ctaBtn');
    if (cta) {
      cta.disabled = false;
      cta.addEventListener('click', () => {
        window.location.href = `character-select.html?scenario_id=${scenarioId}`;
      });
    }
  }
}

loadBriefing();
