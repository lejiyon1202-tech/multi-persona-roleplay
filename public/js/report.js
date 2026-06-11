const params    = new URLSearchParams(location.search);
const SESSION_ID = params.get('session_id');
const ROLE_COLORS = { executive:'#312E2B', manager:'#1B3250', lead:'#1A3D30', member:'#6B3B1D' };


/* ── 탭 전환 ── */
document.querySelectorAll('.report-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab${tab.dataset.tab === 'single' ? 'Single' : 'Compare'}`).classList.add('active');
    if (tab.dataset.tab === 'compare') {
      const isV2 = document.getElementById('reportV2') && !document.getElementById('reportV2').classList.contains('hidden');
      if (!isV2) loadCompare();  // v2는 character_comparison 이미 렌더·legacy /compare 호출 안 함
    }
  });
});

/* ── 뒤로가기 / 재도전 ── */
document.getElementById('backBtn').addEventListener('click', () => history.back());
document.getElementById('retryBtn').addEventListener('click', () => {
  const scenarioId = new URLSearchParams(location.search).get('scenario_id');
  window.location.href = `character-select.html${scenarioId ? `?scenario_id=${scenarioId}` : ''}`;
});

/* ── 피드백 아코디언 ── */
document.addEventListener('click', e => {
  const header = e.target.closest('.feedback-card-header');
  if (!header) return;
  header.closest('.feedback-card').classList.toggle('open');
});

/* ── 리포트 로드 ── */
async function loadReport() {
  try {
    const res  = await fetch(`/api/sessions/${SESSION_ID}/report`);
    const data = await res.json();
    renderReport(data);
  } catch {
    renderDemoReport();
  }
}

function renderReport(data) {
  // schema_version 2 → 신규 학습자용 리포트 / 1·없음 → 구버전 레이아웃 + "이전 버전 평가" 배너
  if (Number(data.schema_version) >= 2) {
    document.getElementById('reportV2')?.classList.remove('hidden');
    document.getElementById('reportLegacy')?.classList.add('hidden');
    renderReportV2(data);
    return;
  }
  document.getElementById('reportV2')?.classList.add('hidden');
  document.getElementById('reportLegacy')?.classList.remove('hidden');
  document.getElementById('legacyBanner')?.classList.remove('hidden');

  const total = data.total_score || 0;
  const grade = data.grade || (total >= 23.75 ? '됐어!' : total >= 20 ? '아쉽지만...' : '느낌이 안 와');
  const gradeClass = grade === '됐어!' ? 'pass' : grade === '아쉽지만...' ? 'partial' : 'fail';

  document.getElementById('scoreNum').textContent = total.toFixed(1);
  document.getElementById('scoreCircle').className = `score-circle ${gradeClass}`;
  document.getElementById('scoreGrade').textContent = grade;

  if (data.character) {
    document.getElementById('charBadge').textContent = data.character.role_level || '—';
    document.getElementById('charNameDisplay').textContent = data.character.name || '—';
  }

  const scores = data.scores || {};
  animateBar('r26Bar', 'r26Val', scores.r26 || 0, 15);
  animateBar('r27Bar', 'r27Val', scores.r27 || 0, 5);
  animateBar('r28Bar', 'r28Val', scores.r28 || 0, 5);

  renderFeedback(data.feedback);
  renderRichSections(data);
}

function renderDemoReport() {
  renderReport({
    total_score: 18.5,
    character: { name: '이모델 파트장', role_level: '파트장' },
    scores: { r26: 11.0, r27: 4.0, r28: 3.5 },
    feedback: [
      { axis: 'R-26 행동지표 관찰 가능성', score: 0.8, text: '학습자 발화에서 구체적 행동 지표가 관찰되었습니다. 특히 3-5턴에서 상대방 감정을 인식하고 반응하는 모습이 명확하게 나타났습니다.' },
      { axis: 'R-26 시나리오 구체성', score: 0.7, text: '상황에 맞는 발화를 유지했으나, 일부 추상적 표현이 있었습니다. 구체적 사실이나 사례를 더 활용하면 좋을 것 같습니다.' },
      { axis: 'R-28 캐릭터 페르소나 일관성', score: 0.6, text: 'AI 캐릭터가 파트장 A의 페르소나를 전반적으로 유지했습니다. 감정 단계 전환 시 일관성이 약간 흔들렸습니다.' }
    ]
  });
}

function animateBar(barId, valId, value, max) {
  document.getElementById(valId).textContent = `${value.toFixed(1)} / ${max}`;
  requestAnimationFrame(() => {
    document.getElementById(barId).style.width = `${(value / max) * 100}%`;
  });
}

function renderFeedback(feedback) {
  const container = document.getElementById('feedbackCards');

  // New object format: { overall, highlight_positive, ... }
  if (feedback && typeof feedback === 'object' && !Array.isArray(feedback)) {
    const overall = feedback.overall || '';
    container.innerHTML = overall
      ? `<div class="feedback-card open">
           <div class="feedback-card-header"><div class="feedback-card-left"><span class="feedback-axis">종합 피드백</span></div></div>
           <div class="feedback-card-body">${escHtml(overall)}</div>
         </div>`
      : '<p class="feedback-empty">피드백 데이터가 없습니다.</p>';
    return;
  }

  // Legacy array format
  const items = Array.isArray(feedback) ? feedback : [];
  if (!items.length) {
    container.innerHTML = '<p class="feedback-empty">피드백 데이터가 없습니다.</p>';
    return;
  }
  container.innerHTML = items.map(item => {
    const sc = item.score >= 0.8 ? 'good' : item.score >= 0.5 ? 'mid' : 'low';
    const sl = item.score >= 0.8 ? '우수' : item.score >= 0.5 ? '보통' : '미흡';
    return `<div class="feedback-card">
      <div class="feedback-card-header">
        <div class="feedback-card-left">
          <span class="feedback-axis">${escHtml(item.axis)}</span>
          <span class="feedback-score-badge ${sc}">${sl} (${item.score.toFixed(1)})</span>
        </div>
        <svg class="feedback-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="feedback-card-body">${escHtml(item.text)}</div>
    </div>`;
  }).join('');
}

/* ── Rich 섹션 렌더러 (Phase D-2) ── */

function renderRichSections(data) {
  const fb = data.feedback || {};
  if (data.scores?.axes)               renderRadar(data.scores.axes);
  if (fb.highlight_positive || fb.highlight_improve) renderHighlights(fb.highlight_positive, fb.highlight_improve);
  if (fb.emotion_track?.length)        renderEmotionTrack(fb.emotion_track);
  if (fb.next_challenges?.length)      renderNextChallenges(fb.next_challenges);
  if (fb.self_learning)                renderSelfLearning(fb.self_learning);
  else if (fb.guide_items?.length)     renderGuideItems(fb.guide_items);
}

function renderRadar(axes) {
  const CX = 110, CY = 110, R = 82;
  const keys = ['경청과공감','이해관계조정','목표설정지원','동기부여소통','갈등조율'];
  const N = keys.length;
  const ang = i => (i * 2 * Math.PI / N) - Math.PI / 2;
  const pt  = (v, r) => [+(CX + r * Math.cos(ang(v))).toFixed(2), +(CY + r * Math.sin(ang(v))).toFixed(2)];

  let svg = '';
  // Grid rings
  for (let ring = 1; ring <= 5; ring++) {
    const pts = keys.map((_, i) => pt(i, ring / 5 * R).join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="var(--border)" stroke-width="1" opacity="0.6"/>`;
  }
  // Axis lines
  for (let i = 0; i < N; i++) {
    const [x, y] = pt(i, R);
    svg += `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1" opacity="0.5"/>`;
  }
  // Data polygon
  const vals = keys.map(k => Math.min(Math.max(Number(axes[k]) || 0, 0), 1));
  svg += `<polygon points="${vals.map((v, i) => pt(i, v * R).join(',')).join(' ')}" fill="var(--role-lead)" fill-opacity="0.2" stroke="var(--role-lead)" stroke-width="2"/>`;
  vals.forEach((v, i) => {
    const [x, y] = pt(i, v * R);
    svg += `<circle cx="${x}" cy="${y}" r="4" fill="var(--role-lead)"/>`;
  });
  // Labels
  keys.forEach((k, i) => {
    const [lx, ly] = pt(i, R + 17);
    const anc = lx < CX - 4 ? 'end' : lx > CX + 4 ? 'start' : 'middle';
    svg += `<text x="${lx}" y="${ly}" text-anchor="${anc}" font-size="9" fill="var(--text-muted)" font-family="'Pretendard',sans-serif">${k}</text>`;
  });

  document.getElementById('radarChart').innerHTML = svg;
  document.getElementById('radarLegend').innerHTML = keys.map((k, i) =>
    `<div class="radar-legend-item">
       <div class="radar-legend-dot"></div>
       <span class="radar-legend-label">${k}</span>
       <span class="radar-legend-score">${(vals[i] * 100).toFixed(0)}%</span>
     </div>`).join('');
  document.getElementById('radarSection').classList.remove('hidden');
}

function renderHighlights(pos, imp) {
  const cards = [...(pos || []).map(h => ({...h, type:'good'})), ...(imp || []).map(h => ({...h, type:'bad'}))];
  if (!cards.length) return;
  document.getElementById('highlightGrid').innerHTML = cards.map(h =>
    `<div class="highlight-card highlight-card--${h.type}">
       <div class="highlight-card-head">
         <span class="highlight-card-icon">${h.type === 'good' ? '✅' : '💡'}</span>
         ${h.type === 'good' ? '우수 발화' : '개선 포인트'} · ${h.turn}번 발화
       </div>
       <div class="highlight-card-body">
         <p class="highlight-quote">"${escHtml(h.quote)}"</p>
         <p class="highlight-comment">${escHtml(h.reason)}</p>
       </div>
     </div>`).join('');
  document.getElementById('highlightSection').classList.remove('hidden');
}

function renderEmotionTrack(tracks) {
  const STAGES = ['방어','저항','수용'];
  const ICONS  = {'방어':'🛡️','저항':'⚡','수용':'🤝'};
  const wrap = document.getElementById('emotionTrack');
  wrap.innerHTML = tracks.map(track => {
    const reached = new Set([...(track.stages_reached || []), track.final_stage].filter(Boolean));
    const row = STAGES.map(s => {
      const ok = reached.has(s);
      const turn = (ok && s === track.final_stage && track.reached_at_turn) ? `${track.reached_at_turn}턴` : (ok ? '도달' : '—');
      return `<div class="emotion-stage${ok ? ' reached' : ''}">
        <div class="emotion-stage-icon">${ICONS[s] || '○'}</div>
        <div class="emotion-stage-label">${s}</div>
        <div class="emotion-stage-turn">${turn}</div>
      </div>`;
    }).join('');
    return `<div>
      <p class="emotion-char-label">${escHtml(track.character)}</p>
      <div class="emotion-stages-row">${row}</div>
    </div>`;
  }).join('');
  document.getElementById('emotionTrackSection').classList.remove('hidden');
}

function renderNextChallenges(challenges) {
  document.getElementById('nextGrid').innerHTML = challenges.map(c =>
    `<div class="next-card">
       <div class="next-card-avatar next-card-avatar--initial">
         ${escHtml((c.character_name || '?')[0])}
       </div>
       <p class="next-card-name">${escHtml(c.character_name)}</p>
       <p class="next-card-reason">${escHtml(c.reason)}${c.difficulty ? `<br><span class="next-difficulty">난이도: ${c.difficulty}</span>` : ''}${c.job_perspective ? `<br><span class="next-job-perspective">${escHtml(c.job_perspective)}</span>` : ''}</p>
     </div>`).join('');
  document.getElementById('nextSection').classList.remove('hidden');
}

function renderSelfLearning(sl) {
  const items = [
    { label: '돌아보기', text: sl.reflection_question },
    { label: '핵심 배움', text: sl.key_learning },
    { label: '다음 집중', text: sl.retry_tip },
  ].filter(i => i.text);
  document.getElementById('guideBox').innerHTML = items.map((item, i) =>
    `<div class="guide-item">
       <span class="guide-item-num">${escHtml(item.label)}</span>
       ${escHtml(item.text)}
     </div>`).join('');
  document.getElementById('guideSection').classList.remove('hidden');
}

function renderGuideItems(items) {
  document.getElementById('guideBox').innerHTML = items.map((tip, i) =>
    `<div class="guide-item">
       <span class="guide-item-num">${String(i + 1).padStart(2, '0')}</span>
       ${escHtml(tip)}
     </div>`).join('');
  document.getElementById('guideSection').classList.remove('hidden');
}

/* ── 비교 리포트 ── */
async function loadCompare() {
  const scenarioId = new URLSearchParams(location.search).get('scenario_id');
  if (!scenarioId) return;
  try {
    const res  = await fetch(`/api/sessions/compare?session_id=${SESSION_ID}&scenario_id=${scenarioId}`);
    const data = await res.json();
    if (data.sessions && data.sessions.length >= 2) renderCompare(data);
  } catch { /* 데모 모드 유지 */ }
}

function renderCompare(data) {
  const container = document.getElementById('compareContent');
  const sessions  = data.sessions;
  const axes      = ['R-26', 'R-27', 'R-28', '총점'];
  const colors    = sessions.map(s => {
    const rk = { '상위리더':'executive','그룹장':'manager','파트장':'lead','부서원':'member' }[s.character?.role_level] || 'lead';
    return ROLE_COLORS[rk];
  });

  container.innerHTML = `
    <div class="compare-grid">
      ${sessions.map((s, i) => {
        const rk = { '상위리더':'executive','그룹장':'manager','파트장':'lead','부서원':'member' }[s.character?.role_level] || ['executive','manager','lead','member'][i % 4];
        return `
        <div class="compare-card">
          <div class="compare-card-header">
            <div class="compare-avatar avatar-bg ${rk}">${(s.character?.name || '?')[0]}</div>
            <div>
              <p class="compare-name">${escHtml(s.character?.name || '—')}</p>
              <span class="role-badge ${rk}">${s.character?.role_level || '—'}</span>
            </div>
          </div>
          <p class="compare-score ${s.total_score >= 23.75 ? 'good' : s.total_score >= 20 ? 'mid' : 'bad'}">
            ${(s.total_score || 0).toFixed(1)}<small class="score-small"> / 25</small>
          </p>
        </div>`;
      }).join('')}
    </div>
    <div class="radar-wrap">
      <p class="radar-title">축별 비교</p>
      ${buildRadar(sessions, colors)}
    </div>
    <table class="compare-table">
      <thead><tr><th>평가 축</th>${sessions.map(s => `<th>${escHtml(s.character?.name || '—')}</th>`).join('')}</tr></thead>
      <tbody>
        ${axes.map(axis => `
          <tr>
            <td>${axis}</td>
            ${sessions.map(s => {
              const v = axis === '총점' ? s.total_score : (s.scores || {})[axis.toLowerCase().replace('-','')];
              return `<td>${v != null ? parseFloat(v).toFixed(1) : '—'}</td>`;
            }).join('')}
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function buildRadar(sessions, colors) {
  const W = 300, CX = 150, CY = 150, R = 110;
  const axes = ['R-26\n(15점)', 'R-27\n(5점)', 'R-28\n(5점)'];
  const N = axes.length;
  const angle = i => (i * 2 * Math.PI / N) - Math.PI / 2;
  const pt = (val, max, i) => {
    const r = (val / max) * R;
    return [CX + r * Math.cos(angle(i)), CY + r * Math.sin(angle(i))];
  };

  let svg = `<svg id="radarChart" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">`;

  // 격자
  for (let ring = 1; ring <= 5; ring++) {
    const pts = Array.from({length: N}, (_, i) => {
      const r = (ring / 5) * R;
      return `${CX + r * Math.cos(angle(i))},${CY + r * Math.sin(angle(i))}`;
    }).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  }
  // 축 선
  for (let i = 0; i < N; i++) {
    svg += `<line x1="${CX}" y1="${CY}" x2="${CX + R * Math.cos(angle(i))}" y2="${CY + R * Math.sin(angle(i))}" stroke="var(--border)" stroke-width="1"/>`;
  }

  // 데이터 폴리곤
  const maxVals = [15, 5, 5];
  sessions.forEach((s, si) => {
    const scores = s.scores || {};
    const vals   = [scores.r26 || 0, scores.r27 || 0, scores.r28 || 0];
    const pts    = vals.map((v, i) => pt(v, maxVals[i], i).join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="${colors[si]}" fill-opacity="0.15" stroke="${colors[si]}" stroke-width="2"/>`;
  });

  // 레이블
  for (let i = 0; i < N; i++) {
    const lx = CX + (R + 22) * Math.cos(angle(i));
    const ly = CY + (R + 22) * Math.sin(angle(i));
    const lines = axes[i].split('\n');
    svg += `<text x="${lx}" y="${ly - (lines.length-1)*7}" text-anchor="middle" font-size="10" fill="var(--text-muted)" font-family="'Pretendard',sans-serif">`;
    lines.forEach((line, li) => {
      svg += `<tspan x="${lx}" dy="${li === 0 ? 0 : 13}">${line}</tspan>`;
    });
    svg += `</text>`;
  }
  svg += `</svg>`;
  return svg;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── 신규 리포트 v2 (학습자용·내부 척도 0) ── */
const V2_LV = { '탁월':'excellent', '안정적':'stable', '발전중':'growing' };
const V2_FS = { '방어':'defend', '저항':'resist', '수용':'accept' };
const V2_PCT = { '탁월':1.0, '안정적':0.6, '발전중':0.25, '관찰부족':0 };
const AXES5_MULTI = ['입장파악력','조율중재력','설득영향력','발언타이밍','관계인식'];
const AXES5_SINGLE = ['경청과공감','이해관계조정','목표설정지원','동기부여소통','갈등조율'];
function setTxt(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function renderReportV2(data) {
  const lvl = document.getElementById('overallLevel');
  if (lvl) { lvl.textContent = data.overall_level || '발전중'; lvl.className = `level-badge-lg level-${V2_LV[data.overall_level] || 'growing'}`; }
  setTxt('scenarioTitle', data.scenario_title || '');
  setTxt('learnerRole', data.character?.role_level || '');
  setTxt('learnerName', data.character?.name || '');

  renderV2Radar(data.axes || [], data.session_type);
  renderAxisLevels(data.axes || []);
  renderStrengths(data.strengths || []);
  renderOIS(data.improvements || []);
  renderV2Next(data.next_challenges || []);
  renderV2Compare(data.character_comparison || [], data.session_type);
}

function renderV2Radar(axes, sessionType) {
  const el = document.getElementById('v2RadarChart');
  if (!el || !axes.length) return;
  setTxt('axisTypeLabel', sessionType === 'multi' ? '다자 토론 5축' : '1:1 코칭 5축');
  const CX=110, CY=110, R=82, N=axes.length;
  const ang = i => (i*2*Math.PI/N) - Math.PI/2;
  const pt = (r,i) => [+(CX+r*Math.cos(ang(i))).toFixed(2), +(CY+r*Math.sin(ang(i))).toFixed(2)];
  let svg='';
  for (let ring=1; ring<=5; ring++) svg += `<polygon points="${axes.map((_,i)=>pt(ring/5*R,i).join(',')).join(' ')}" fill="none" stroke="var(--border)" stroke-width="1" opacity="0.6"/>`;
  for (let i=0;i<N;i++){ const [x,y]=pt(R,i); svg+=`<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="var(--border)" stroke-width="1" opacity="0.5"/>`; }
  const vals = axes.map(a => V2_PCT[a.level] ?? 0.25);
  svg += `<polygon points="${vals.map((v,i)=>pt(v*R,i).join(',')).join(' ')}" fill="var(--role-lead)" fill-opacity="0.2" stroke="var(--role-lead)" stroke-width="2"/>`;
  vals.forEach((v,i)=>{ const [x,y]=pt(v*R,i); svg+=`<circle cx="${x}" cy="${y}" r="4" fill="var(--role-lead)"/>`; });
  axes.forEach((a,i)=>{ const [lx,ly]=pt(R+17,i); const anc=lx<CX-4?'end':lx>CX+4?'start':'middle'; svg+=`<text x="${lx}" y="${ly}" text-anchor="${anc}" font-size="9" fill="var(--text-muted)">${escHtml(a.key)}</text>`; });
  el.innerHTML = svg;
  const lg = document.getElementById('v2RadarLegend');
  if (lg) lg.innerHTML = axes.map(a=>`<div class="radar-legend-item"><div class="radar-legend-dot"></div><span class="radar-legend-label">${escHtml(a.key)}</span><span class="radar-legend-score">${escHtml(a.level)}</span></div>`).join('');
}

function renderAxisLevels(axes) {
  const el = document.getElementById('axisLevelGrid');
  if (!el) return;
  el.innerHTML = axes.map(a=>`<div class="axis-level-card"><div class="axis-level-head"><span class="axis-level-name">${escHtml(a.key)}</span><span class="level-badge level-${V2_LV[a.level]||'growing'}">${escHtml(a.level)}</span></div><p class="axis-level-note">${escHtml(a.behavior_note||'')}</p></div>`).join('');
}

function renderStrengths(strengths) {
  const el = document.getElementById('strengthGrid');
  if (!el) return;
  el.innerHTML = strengths.map(s=>`<div class="strength-card"><div class="strength-head">✅ ${escHtml(s.axis||'')} · ${s.turn}번 발화</div><p class="strength-quote">"${escHtml(s.quote||'')}"</p><p class="strength-why">${escHtml(s.why||'')}</p><p class="strength-keep">→ ${escHtml(s.keep||'')}</p></div>`).join('');
}

function renderOIS(improvements) {
  const el = document.getElementById('oisList');
  if (!el) return;
  el.innerHTML = improvements.map(im=>{
    const o=im.observation||{}, s=im.suggestion||{};
    return `<div class="ois-card"><div class="ois-step ois-obs"><span class="ois-label">관찰</span><p>"${escHtml(o.quote||'')}" <span class="ois-turn">${o.turn}번 발화</span></p></div><div class="ois-step ois-impact"><span class="ois-label">영향</span><p>${escHtml(im.impact||'')}</p></div><div class="ois-step ois-suggest"><span class="ois-label">제안</span><p>${escHtml(s.alternative||'')}</p>${s.replay_scenario?`<p class="ois-replay">🔁 재연습: ${escHtml(s.replay_scenario)}</p>`:''}</div></div>`;
  }).join('');
}

function renderV2Next(challenges) {
  const el = document.getElementById('v2NextGrid');
  if (!el) return;
  el.innerHTML = challenges.map(c=>`<div class="next-card"><div class="next-card-avatar next-card-avatar--initial">${escHtml((c.character_name||'?')[0])}</div><p class="next-card-name">${escHtml(c.character_name||'')}</p><p class="next-card-reason">${escHtml(c.reason||'')}${c.difficulty?`<br><span class="next-difficulty">난이도: ${escHtml(c.difficulty)}</span>`:''}${c.job_perspective?`<br><span class="next-job-perspective">${escHtml(c.job_perspective)}</span>`:''}</p></div>`).join('');
}

function renderV2Compare(comparison, sessionType) {
  const grid = document.getElementById('compareGrid');
  const empty = document.getElementById('compareEmpty');
  if (!grid) return;
  if (!comparison.length) { if (empty) empty.classList.remove('hidden'); grid.classList.add('hidden'); return; }
  if (empty) empty.classList.add('hidden');
  grid.classList.remove('hidden');  // 빈 화면 방지 — hidden 해제 (catch: report.html 기본 hidden)
  // 5축 고정 순회 + key 매핑 (비교 성립·윈터) — 미관찰/관찰부족 축은 "—" 회색(환각 0·박진영)
  const axes5 = sessionType === 'multi' ? AXES5_MULTI : AXES5_SINGLE;
  grid.innerHTML = comparison.map(c => {
    const lvMap = {};
    (c.axis_levels || []).forEach(a => { lvMap[a.key] = a.level; });
    const rows = axes5.map(k => {
      const lv = lvMap[k];
      const unobs = !lv || lv === '관찰부족';
      const cls = unobs ? 'none' : (V2_LV[lv] || 'growing');
      const txt = unobs ? '—' : lv;
      return `<div class="compare-axis-row"><span>${escHtml(k)}</span><span class="level-badge level-${cls}">${escHtml(txt)}</span></div>`;
    }).join('');
    return `<div class="compare-card"><div class="compare-card-header"><p class="compare-name">${escHtml(c.character||'')}</p><span class="stage-badge stage-${V2_FS[c.final_stage]||'defend'}">${escHtml(c.final_stage||'')}</span></div><div class="compare-axes">${rows}</div></div>`;
  }).join('');
}

loadReport();

