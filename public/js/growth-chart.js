/* ── C안 Step 2: 다회차 성장 기록 Canvas 라인 차트 ── */
(function () {
  const params     = new URLSearchParams(location.search);
  const learnerId  = params.get('learner_id') || sessionStorage.getItem('learner_id');
  const scenarioId = params.get('scenario_id');
  const MAX_SCORE  = 25;

  let loaded = false;

  /* growth 탭 클릭 시 1회만 로드 */
  document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'growth' && !loaded) {
        loaded = true;
        loadGrowthData();
      }
    });
  });

  async function loadGrowthData() {
    if (!learnerId || !scenarioId) { showEmpty(); return; }
    try {
      const res    = await fetch(`/api/learners/${encodeURIComponent(learnerId)}/history?scenario_id=${encodeURIComponent(scenarioId)}`);
      const data   = await res.json();
      const rounds = Array.isArray(data.rounds) ? data.rounds : [];
      if (rounds.length < 2) { showEmpty(); return; }
      renderChart(rounds);
    } catch {
      showEmpty();
    }
  }

  function showEmpty() {
    document.getElementById('growthEmpty')?.classList.remove('hidden');
    document.getElementById('growthChartWrap')?.classList.add('hidden');
  }

  function renderChart(rounds) {
    document.getElementById('growthEmpty')?.classList.add('hidden');
    document.getElementById('growthChartWrap')?.classList.remove('hidden');

    const canvas = document.getElementById('growthChart');
    if (!canvas || !canvas.getContext) return;

    /* CSS 변수에서 테마 색상 추출 (Canvas는 CSS 변수 직접 사용 불가) */
    const rootStyle   = getComputedStyle(document.documentElement);
    const CHART_COLOR = rootStyle.getPropertyValue('--role-lead').trim() || '#1A3D30';
    const MUTED_COLOR = rootStyle.getPropertyValue('--text-muted').trim() || 'rgba(0,0,0,0.4)';
    const GRID_COLOR  = rootStyle.getPropertyValue('--border').trim() || 'rgba(0,0,0,0.1)';

    /* DPR 대응 */
    const dpr  = window.devicePixelRatio || 1;
    const card = canvas.parentElement;
    const W    = card.clientWidth - 48;  /* 카드 패딩 좌우 24px씩 제거 */
    const H    = 260;

    canvas.width        = W * dpr;
    canvas.height       = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    /* 레이아웃 여백 */
    const PAD_L = 48, PAD_R = 20, PAD_T = 24, PAD_B = 42;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const scores = rounds.map(r => Number(r.total_score) || 0);
    const n      = scores.length;
    const xStep  = n > 1 ? chartW / (n - 1) : chartW;

    const toX = i => PAD_L + i * xStep;
    const toY = v => PAD_T + chartH - (v / MAX_SCORE) * chartH;

    /* y축 그리드 라인 + 라벨 */
    [0, 5, 10, 15, 20, 25].forEach(tick => {
      const y = toY(tick);
      ctx.beginPath();
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth   = 1;
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(PAD_L + chartW, y);
      ctx.stroke();

      ctx.fillStyle  = MUTED_COLOR;
      ctx.font       = `11px Pretendard, sans-serif`;
      ctx.textAlign  = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(tick, PAD_L - 7, y);
    });

    /* x축 라벨 */
    ctx.fillStyle    = MUTED_COLOR;
    ctx.font         = `11px Pretendard, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    rounds.forEach((r, i) => {
      ctx.fillText(`${r.round}회차`, toX(i), H - PAD_B + 10);
    });

    /* 채우기 영역 */
    ctx.beginPath();
    scores.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.lineTo(toX(n - 1), toY(0));
    ctx.lineTo(toX(0), toY(0));
    ctx.closePath();
    ctx.fillStyle = CHART_COLOR + '14'; /* 8% 투명 */
    ctx.fill();

    /* 라인 */
    ctx.beginPath();
    ctx.strokeStyle = CHART_COLOR;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    scores.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    /* 데이터 포인트 + 점수 라벨 */
    scores.forEach((v, i) => {
      const x = toX(i);
      const y = toY(v);

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle   = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CHART_COLOR;
      ctx.lineWidth   = 2.5;
      ctx.stroke();

      ctx.fillStyle    = CHART_COLOR;
      ctx.font         = `bold 12px Pretendard, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(v.toFixed(1), x, y - 9);
    });

    /* 범례 */
    const legend = document.getElementById('growthLegend');
    if (legend) {
      legend.innerHTML = `<div class="growth-legend-item">
        <div class="growth-legend-dot" style="background:${CHART_COLOR}"></div>
        시나리오 총점 (/ ${MAX_SCORE}점 만점)
      </div>`;
    }
  }
})();
