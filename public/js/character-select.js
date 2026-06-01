let selectedCard = null;
let selectedData = {};


/* ── CTA 버튼 이벤트 ── */
document.querySelectorAll('.cta-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const { charName, roleClass, charNumber } = btn.dataset;
    window.location.href = `chat.html?character=${charNumber}`;
  });
});

/* ── start 버튼 이벤트 ── */
document.getElementById('startBtn').addEventListener('click', goToChat);

/* ── 카드 클릭 (선택 가능 카드만) ── */
document.querySelectorAll('.char-card.selectable').forEach(card => {
  card.addEventListener('click', () => selectCard(card));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectCard(card); });
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `${card.dataset.name} 선택 — ${card.dataset.role}`);
});

function selectCard(card) {
  // 이전 선택 해제
  if (selectedCard && selectedCard !== card) {
    selectedCard.classList.remove('selected');
    const prev = selectedCard.querySelector('.cta-check');
    if (prev) prev.style.opacity = '0';
  }

  const isSelected = card.classList.toggle('selected');
  const check = card.querySelector('.cta-check');

  if (isSelected) {
    selectedCard = card;
    if (check) check.style.opacity = '1';
    selectedData = {
      name: card.dataset.name,
      role: card.dataset.role,
      number: card.dataset.number,
      emoji: card.dataset.emoji,
      roleClass: card.className.match(/role-\w+/)?.[0] || ''
    };
    updateStartBar(true);
  } else {
    selectedCard = null;
    if (check) check.style.opacity = '0';
    updateStartBar(false);
  }
}

function updateStartBar(visible) {
  const bar = document.getElementById('startBar');
  bar.classList.toggle('visible', visible);

  if (visible) {
    const roleColors = {
      'role-lead':    '#134e4a',
      'role-member':  '#78350f',
      'role-executive': '#312e81',
      'role-manager': '#1e3a8a'
    };
    const avatar = document.getElementById('selectedAvatar');
    avatar.textContent = selectedData.emoji;
    avatar.style.background = roleColors[selectedData.roleClass] || '#374151';
    document.getElementById('selectedName').textContent = selectedData.name;
    document.getElementById('selectedRole').textContent = selectedData.role;

    const btn = document.getElementById('startBtn');
    btn.style.background = roleColors[selectedData.roleClass] || '#374151';
  }
}

function goToChat() {
  if (!selectedData.number) return;
  window.location.href = `chat.html?character=${selectedData.number}`;
}

