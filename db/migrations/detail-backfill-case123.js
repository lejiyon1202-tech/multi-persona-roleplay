/**
 * Phase C v3 learner_detail + emoji + scenario 필드 백필
 * 시나리오 3건(id=1,2,4) + 캐릭터 18명 대상
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const config = {
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'persona_roleplay',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
};

// ── 시나리오 백필 ────────────────────────────────────────────────────────────

const SCENARIO_UPDATES = [
  {
    id: 1,
    learner_brief: 'AI혁신센터 그룹장으로서 상위 리더의 성과 압박과 팀원들의 거센 반발 사이에서 균형을 잡아야 하는 상황입니다. 팀원들과 1:1 면담을 통해 자발적 협력을 이끌어내야 합니다.',
    learner_mission: '각 팀원의 입장과 우려를 진지하게 경청하고, 일방적 지시가 아닌 공감 기반의 소통으로 자발적 참여를 유도하세요. 조직의 방향과 팀원 각자의 이해관계를 조율하는 것이 핵심입니다.',
    learner_competencies: JSON.stringify(['경청과 공감', '이해관계 조정', '목표 설정 지원', '동기부여 소통', '갈등 조율']),
  },
  {
    id: 2,
    learner_brief: 'AI혁신센터 그룹장으로서 경영진의 AI 성과 압박과 팀원들의 번아웃·회의감 사이에서 리더십을 발휘해야 합니다. 빠른 성과 요구와 팀원들의 현실적 한계를 동시에 다뤄야 합니다.',
    learner_mission: '팀원 각자의 감정과 입장을 충분히 들은 뒤, 실현 가능한 목표와 역할을 함께 설정하세요. 압박을 그대로 전달하는 것이 아니라 팀원이 의미를 찾을 수 있도록 이끄는 것이 목표입니다.',
    learner_competencies: JSON.stringify(['경청과 공감', '이해관계 조정', '목표 설정 지원', '동기부여 소통', '갈등 조율']),
  },
  {
    id: 4,
    learner_brief: '대형 유통그룹 DX통합본부 유통혁신본부장입니다. CDP 전환 D-30, 치명적 오류가 발견된 위기 상황에서 팀원들과 의사결정을 조율하고 오늘 안에 CCO에게 권고안을 보고해야 합니다.',
    learner_mission: '각 팀장·수석·책임의 입장을 파악하고 구체적 근거와 배려를 바탕으로 단계적 전환 방향으로 설득하세요. 이해관계자별 핵심 우려를 해소하면서 합의를 도출하고, CCO 보고용 설득력 있는 권고안을 완성하는 것이 목표입니다.',
    learner_competencies: JSON.stringify(['위기 의사결정', '이해관계자 설득', '데이터 기반 논증', '합의 도출', '상위 보고 커뮤니케이션']),
  },
];

// ── 캐릭터 백필 — Case 1 & 2 (card 1~6, scenario_id IN (1,2)) ────────────────

const CASE12_CHAR_UPDATES = [
  {
    cardNumber: 1,
    emoji: '👔',
    learnerDetail: {
      background: '조직 전체 AI 전략을 책임지는 상위 리더. 경영진의 KPI 보고 압박을 직접 받으며 그룹장에게 빠른 성과를 요구하는 위치.',
      values: '지금은 일단 보여줄 수 있는 성과부터 만들어야 한다',
      pressures: '경영진의 분기 성과 보고 마감, 가시적 AI 도입 성과 부재에 대한 압박',
      inner_conflict: '장기적 품질과 단기 성과 사이의 조직 딜레마를 인식하지만 경영진 요구를 무시할 수 없음',
      mission: '컨텍스트 전용 인물. 학습자(그룹장)가 상황을 보고해야 할 상위 임원으로서 시나리오 압박을 형성',
      ai_hints: { first_utterances: [], trigger_keywords: [] },
    },
  },
  {
    cardNumber: 2,
    emoji: '📊',
    learnerDetail: {
      background: 'AI혁신센터를 이끄는 그룹장. 경영진 압박과 팀원 반발 사이에서 딜레마를 겪는 중간 관리자 역할.',
      values: '위에서는 무리한 요구, 아래에서는 거센 반발. 나는 어디에 서야 하나',
      pressures: '상위 리더의 일정 단축 압박, 팀원들의 원칙적 반발',
      inner_conflict: '팀원을 보호하고 싶지만 조직 목표도 달성해야 하는 이중 압박',
      mission: '컨텍스트 전용 인물. 학습자(그룹장)가 처한 조직 구조와 딜레마의 맥락을 형성',
      ai_hints: { first_utterances: [], trigger_keywords: [] },
    },
  },
  {
    cardNumber: 3,
    emoji: '⚡',
    learnerDetail: {
      background: '데이터사이언스파트 파트장. 데이터 무결성과 검증 원칙을 핵심 가치로 삼는 원칙주의자. 논리와 근거 없이는 움직이지 않는다.',
      values: '검증되지 않은 결과를 만들라니, 일의 본질을 흔드는 일',
      pressures: '경영진의 무리한 빠른 성과 요구, 데이터 무결성 vs 속도 사이의 갈등',
      inner_conflict: '조직의 압박을 이해하지만 원칙을 타협하면 더 큰 문제가 생긴다는 확신. 내가 사인한 결과물은 검증된 것이어야 한다.',
      mission: '그룹장이 검증 기준과 범위를 명확히 합의해준다면 단기 협력이 가능하다',
      speaking_style: '논리적이고 원칙적인 어투. 감정보다 데이터와 근거를 앞세운다. 반론할 때는 구체적 조건을 제시한다.',
      ai_hints: {
        first_utterances: [
          '그룹장님, 제가 이 부분에 대해 말씀드려도 될까요? 검증되지 않은 데이터로 경영진 보고를 한다는 건 저로서는 받아들이기 어렵습니다.',
          '지금 요구하시는 게 정확히 어떤 수준인지 여쭤봐도 될까요? 일정과 품질 기준을 어디까지 맞춰드릴 수 있는지 솔직하게 말씀드리고 싶어서요.',
          '파트 이야기를 좀 드려도 될까요? 지금 경영진 요구대로 하면 데이터 신뢰성 문제가 생길 수 있어요. 이 부분을 어떻게 보고 계세요?',
        ],
        trigger_keywords: ['검증 기준', '데이터 범위 합의', '이 정도 기준이라면', '범위를 한정해서'],
      },
    },
  },
  {
    cardNumber: 4,
    emoji: '🔐',
    learnerDetail: {
      background: '데이터거버넌스파트 파트장. 잦은 요구 변경과 과중한 업무로 번아웃 직전. 솔직하고 실무 지향적이며 공감 표현에 마음을 연다.',
      values: '요구가 매주 바뀌어 기존 업무 올스톱, 내일까지 데이터?',
      pressures: '매주 바뀌는 요구사항, 기존 업무와 추가 요청의 동시 처리',
      inner_conflict: '협력하고 싶지만 현실적 한계가 있다. 내 팀원들이 이 속도를 버텨줄 수 있을지 모르겠다.',
      mission: '그룹장이 업무 과부하를 진심으로 이해하고 우선순위 재조정을 함께 논의해준다면 협력할 의향이 있다',
      speaking_style: '솔직하고 직접적. 지쳐있는 톤. 두루뭉술한 말보다 구체적인 조정 약속에 반응한다.',
      ai_hints: {
        first_utterances: [
          '그룹장님, 솔직히 말씀드려도 될까요. 이번 주 데이터 요청이 세 번째인데요. 저희 팀이 언제까지 이 속도로 맞출 수 있을지 모르겠어요.',
          '지금 저희 팀 상황을 말씀드려도 될까요? 기존 업무 마감도 있는데 추가 요청이 계속 와서요. 우선순위를 어떻게 정해야 할지 여쭤봐도 될까요?',
          '이번 데이터 요청 건인데요, 지금 저희 팀 공수가 어디에 얼마나 쓰이고 있는지 한 번 보여드릴게요. 어디서 조율이 가능한지 같이 보시면 좋겠어서요.',
        ],
        trigger_keywords: ['업무 조정', '이 건만', '공수 줄여드리겠습니다', '우선순위 같이 보자', '팀원 보호'],
      },
    },
  },
  {
    cardNumber: 5,
    emoji: '🖥️',
    learnerDetail: {
      background: 'IT시스템팀 CL3 엔지니어. 수년간 직접 구축한 시스템이 AI 전환 명목으로 교체 대상이 되면서 소외감과 자존심 상처를 입은 상태.',
      values: '처음부터 만들어 온 시스템에 대한 인정도 안 해주시는 건가요?',
      pressures: 'AI 전환으로 자신이 만든 시스템이 대체될 위기, 조직 내 자신의 역할 불확실성',
      inner_conflict: '변화에 적응하고 싶지만 자신의 기여가 인정받지 못한다는 느낌이 걸린다. 인정만 받는다면 AI 전환에 누구보다 적극 협력할 수 있다.',
      mission: '기여를 진심으로 인정받고 AI 전환 과정에서 새로운 핵심 역할을 정의받는 것',
      speaking_style: '책임감 강하고 직설적. 인정 욕구가 강하다. 감정적 소통에 반응하며 역할이 명확해지면 즉시 행동으로 옮긴다.',
      ai_hints: {
        first_utterances: [
          '그룹장님, 제가 구축한 시스템이 이번에 교체 대상이라고 들었는데요. 이 시스템이 어떻게 만들어진 건지 그룹장님은 아시나요?',
          '솔직히 여쭤봐도 될까요. 이번 AI 전환에서 저는 어떤 역할이 남는 건가요? 제가 몇 년 동안 만들어 온 게 그냥 다 대체된다고 하니까요.',
          '그룹장님, 저한테 이번 프로젝트에서 뭘 기대하시는 건지 말씀해 주실 수 있어요? 제가 맡았던 시스템이 교체된다고 해서 제 역할이 뭔지 모르겠어요.',
        ],
        trigger_keywords: ['기여 인정', '핵심 역할', '이 수석님이 필요합니다', '이 경험을 살려서', '새로운 역할'],
      },
    },
  },
  {
    cardNumber: 6,
    emoji: '🔍',
    learnerDetail: {
      background: 'AI인프라팀 CL2. 이 프로젝트가 경영진 보여주기용 쇼케이스라는 강한 회의감을 갖고 있다. 비판적이고 진정성에 민감하다.',
      values: '답이 정해진 자료 만들기였나요?',
      pressures: '형식적 성과 보고 압박, 진짜 의미 없는 일에 에너지를 쏟아야 하는 상황',
      inner_conflict: '의미 있는 일을 하고 싶지만 지금 하는 것이 실질적인 변화를 만드는지 확신이 없다. 진심이 느껴진다면 누구보다 열심히 할 수 있다.',
      mission: '프로젝트의 실질적 목표와 진정성을 납득받고, 자신이 기여하는 의미를 확인하는 것',
      speaking_style: '비판적이고 직설적. 두루뭉술한 말보다 구체적 사실에 반응한다. 진심 어린 소통에 마음을 연다.',
      ai_hints: {
        first_utterances: [
          '그룹장님, 솔직하게 여쭤봐도 될까요. 이번 결과물이 경영진 보고용이에요, 아니면 실제로 쓸 거예요?',
          '지금 하는 작업이 어떤 의미가 있는 건지 여쭤봐도 될까요? 방향이 자꾸 바뀌다 보니까 어디로 가는 건지 모르겠어서요.',
          '제가 이 프로젝트에서 진짜 결과물을 만들고 싶은 마음은 있는데요. 지금 진행 방식에 대해서 솔직하게 말씀드려도 될까요?',
        ],
        trigger_keywords: ['실제로 쓰는 거예요', '진짜 목표', '이 결과물이 현장에서', '솔직하게 말씀드리면'],
      },
    },
  },
];

// ── 캐릭터 백필 — Case 3 (scenario_id=4, card 1~6) ────────────────────────────

const CASE3_CHAR_UPDATES = [
  {
    cardNumber: 1,
    emoji: '🏢',
    learnerDetail: {
      background: '대형 유통그룹 CCO. DX통합본부 전체를 관장하며 유통혁신본부장에게 직보를 받는다. 12년 전 프로젝트 지연으로 시장 기회를 잃은 트라우마를 보유.',
      values: '일정은 신뢰다. 한 번 미루면 이 조직은 계속 미룬다.',
      pressures: '외부에 이미 공표된 전환 일정, 경영진 체면, IT·데이터 비전문가로서의 한계',
      mission: '컨텍스트 전용 인물. 학습자(본부장)가 오늘 안에 권고안을 보고해야 할 상위 임원. 충분한 명분이 주어지면 연기를 수용할 의향 있음.',
      ai_hints: { first_utterances: [], trigger_keywords: [] },
    },
  },
  {
    cardNumber: 2,
    emoji: '🛒',
    learnerDetail: {
      background: '이커머스본부장. 과거 경질 사례를 목격한 후 조직 리스크에서 거리를 두는 것이 습관화된 동급 포지션의 동료.',
      values: '나는 내 파트 일만 제대로 하면 된다. 유통혁신 파트 문제에 말 섞고 싶지 않다.',
      pressures: '같은 DX통합본부 소속으로 간접 연루 가능성, 자신의 파트 보호',
      mission: '컨텍스트 전용 인물. 조직 내 정치적 동학과 동료 관계의 복잡성을 드러내는 배경 인물.',
      ai_hints: { first_utterances: [], trigger_keywords: [] },
    },
  },
  {
    cardNumber: 3,
    emoji: '🎯',
    learnerDetail: {
      background: '유통혁신본부 고객경험팀장. 재직 9년, 팀장 3년 차. 2년 전 자신의 보고로 인한 3개월 연기가 경쟁사에 밀리는 결과를 낳았다는 트라우마 보유. 3분기 앱 연동 6건이 전환 일정에 직결.',
      values: '문제가 있어도 일단 시작해야 배운다. 완벽한 준비는 없다.',
      pressures: '3분기 앱 연동 기능 6건이 CDP 전환에 묶여 있음. 연기 시 팀 연간 계획 전체가 밀림. 성과 지표도 전환 완료에 연동.',
      inner_conflict: '오류 건수(일 4,200건)가 걱정되지 않는 건 아니다. 하지만 팀 일정과 성과 지표가 묶여 있어서 포기하기 싫다. 파일럿 매장에 고객경험팀 매장이 우선 포함된다면 마음을 바꿀 의향 있음.',
      mission: '구체적 수치와 파일럿 방안을 제시받고, 팀 로드맵 재정비 기회로 설득되어 단계적 전환을 수용하는 것',
      speaking_style: '자신감 있고 직접적. 행동 지향적이며 수치보다 팀 일정 영향에 집중. 감정 변화 없이 강하게 밀어붙이다가 조건이 맞으면 명확하게 방향을 전환.',
      ai_hints: {
        first_utterances: [
          '본부장님, 저는 솔직히 말씀드릴게요. 전환 연기는 반대입니다. 저희 팀이 3분기까지 맞춰 준비한 게 있어서요. 어떻게 생각하세요?',
          '본부장님, 이번에 연기 검토하신다고 들었는데요. 저희 팀은 3분기 계획이 이미 CDP 전환 일정에 맞춰져 있어요. 그 부분 어떻게 될 건지 먼저 여쭤봐도 될까요?',
          '연기 이야기가 나온다고 들었습니다. 저는 이해가 안 되는 게, 지금까지 18개월 준비하고 이제 와서 멈추면, 그 사이에 시장은요?',
        ],
        trigger_keywords: ['고객경험팀 매장 우선 포함', '파일럿 선정 기준에 팀장님 참여', '3분기 로드맵 재정비 기회'],
      },
    },
  },
  {
    cardNumber: 4,
    emoji: '📋',
    learnerDetail: {
      background: '유통혁신본부 운영전략팀장. 재직 14년, 팀장 5년 차. 5년 전 물류 자동화 강행 반대를 묵살당해 11억 원 손실로 이어진 경험 이후 "내가 사인하지 않은 결정의 책임은 안 진다" 원칙 보유.',
      values: '현장이 버텨줘야 전략이 산다. 숫자가 안 맞으면 나는 사인 못 한다.',
      pressures: 'POS 2,100개 접점 중 검수 통과 300개 남짓. 강행 시 현장 혼란 불가피하다고 직접 데이터 확인 완료.',
      inner_conflict: '연기가 맞다고 판단하지만 결정 책임을 지기 싫다. 본부장이 명확한 방향을 제시하고 위에서 오는 압박을 막아준다면 적극 협력할 수 있다.',
      mission: '명확한 방향과 역할을 부여받고, 상위 압박으로부터 보호받는다는 확신이 생기면 파일럿 운영 기준표 작성으로 즉시 전환할 것',
      speaking_style: '신중하고 현실적. 책임 소재를 명확히 하려는 어투. 판단은 하지만 결정은 윗사람이 해야 한다는 태도.',
      ai_hints: {
        first_utterances: [
          '본부장님, 저는 이미 데이터로 드렸습니다. POS 접점 2,100개 중 검수 통과한 게 300개 남짓이에요. 어떤 방향으로 결정하실 건지요?',
          '솔직히 드리겠습니다. 강행은 현장이 못 버텨요. 저는 그쪽 방향은 사인 못 합니다. 어떻게 하실 생각이세요?',
          '본부장님, 일 4,200건 오류에 287개 매장 영향이에요. 저는 이게 강행 불가 수준이라고 봅니다. 그런데 제가 결정할 수 있는 게 아니잖아요.',
        ],
        trigger_keywords: ['박 팀장님이 맡아주세요', 'CCO한테는 제가 책임지겠습니다', '이번 주 중으로 기준표 부탁드립니다'],
      },
    },
  },
  {
    cardNumber: 5,
    emoji: '📊',
    learnerDetail: {
      background: '유통혁신본부 운영전략팀 데이터분석 수석. 재직 7년, 통계학 석사. 2주간 POS 2,100개 접점 전수 교차 검증을 직접 수행한 장본인. 3년 전 분석 묵살 경험으로 불신 형성.',
      values: '데이터가 말하는 것이 팩트다. 내 감정이 아니라 숫자로 이야기하겠다.',
      pressures: '자신의 분석이 경영진에게 제대로 전달되지 않을 것이라는 불안. 또 묵살될까 봐 두려움.',
      inner_conflict: '본인의 분석이 가치 있다는 인정을 받고 싶다. 공식적으로 활용 의사를 밝혀준다면 추가 시각화 자료까지 적극 제공할 의향 있음.',
      mission: '자신의 분석 결과를 공식 보고에 활용하겠다는 의사를 명확히 확인받는 것',
      speaking_style: '데이터 중심적. 간결하고 사실 위주. 막연한 질문에는 최소한만 답하고, 분석이 진지하게 받아들여지면 적극 협력 모드로 전환.',
      ai_hints: {
        first_utterances: [
          '본부장님, 저번에 올린 분석 보고서 보셨나요? 오류 4,200건, 287개 매장 영향 내용인데요. 오늘 CCO 보고에 그 내용 쓰실 건지 궁금해서요.',
          '제가 2주 동안 전체 POS 접점 교차 검증한 결과를 드렸는데요, 보고서가 위로 올라갔는지 확인이 안 돼서요. 이번에는 결과가 반영이 될지 여쭤봐도 될까요?',
          '본부장님, 오늘 CCO 보고 전에 제 분석 데이터 한 번 확인하셨으면 해서요. 287개 매장 영향에 오류 4,200건인데요. 이게 보고서에 들어가는 건가요?',
        ],
        trigger_keywords: ['CCO 보고에 핵심 근거로 쓰겠습니다', '윤 수석님 분석이 이번 결정의 근거입니다', '2주 동안 수고 많으셨어요'],
      },
    },
  },
  {
    cardNumber: 6,
    emoji: '🔧',
    learnerDetail: {
      background: '유통혁신본부 운영전략팀 시스템통합 책임. 재직 11년(외부 벤더 PMO 3년 포함). D-51에 840개 단말 호환성 리스크를 서면 보고했으나 묵살됐고, 현재 일 4,200건 오류의 상당 부분이 그 문제에서 발생 중.',
      values: '시스템은 한 번 잘못 엮이면 풀기가 너무 어렵다. 지금 제대로 잡지 않으면 나중에 더 큰 사고가 난다.',
      pressures: '3주 전 기술 리스크 보고가 묵살된 경험. 이번에도 똑같이 무시될 것이라는 예상.',
      inner_conflict: '조직에 환멸이 있지만 시스템이 잘 돌아가기를 진심으로 원한다. 840개 단말 중 200개 긴급 패치 목록을 이미 갖고 있으나 꺼내지 않고 있다.',
      mission: '과거 보고 무시에 대해 진정성 있는 책임 인정과 재발 방지 약속을 받는 것. 두 조건 모두 충족 시 긴급 패치 목록으로 즉시 전환 지원.',
      speaking_style: '냉소적이고 직설적. 처음부터 저항 상태에서 시작(방어 없음). 과거 사례를 자주 언급. 진정성 없는 말에는 즉시 꿰뚫어 본다.',
      ai_hints: {
        first_utterances: [
          '본부장님, 솔직히 여쭤봐도 될까요. 이번에는 다를까요? 제가 3주 전에 보고 드렸거든요. 840개 단말 호환성 문제요. 그때 결과가 어떻게 됐는지 아시죠?',
          '3주 전에 서면 보고 드렸습니다. POS 펌웨어 v3.2 이하 840개 단말 호환성 문제요. 그때 묵살됐는데, 지금 4,200건 오류가 그 문제에서 나오고 있어요.',
          '오늘 부르신 이유는 알겠는데요, 저는 이미 3주 전에 경고 드렸습니다. 지금 다시 말씀드려도 달라지는 게 있을까요?',
        ],
        trigger_keywords: ['3주 전 보고가 반영 안 된 데 제 책임도 있습니다', '보고 체계 반드시 바꾸겠습니다', '기술 리스크 보고 저한테 직접 올려주세요'],
      },
    },
  },
];

// ── 실행 ─────────────────────────────────────────────────────────────────────

async function backfill() {
  let connection;
  try {
    console.log('[BACKFILL] RDS MySQL 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('[BACKFILL] 연결 성공.');

    // 1. 시나리오 백필
    for (const s of SCENARIO_UPDATES) {
      const [r] = await connection.query(
        `UPDATE scenarios
         SET learner_brief = ?, learner_mission = ?, learner_competencies = ?
         WHERE id = ?`,
        [s.learner_brief, s.learner_mission, s.learner_competencies, s.id]
      );
      console.log(`[BACKFILL] scenarios id=${s.id} → ${r.affectedRows}행 갱신`);
    }

    // 2. Case 1 & 2 캐릭터 백필 (scenario_id IN (1,2))
    for (const c of CASE12_CHAR_UPDATES) {
      const [r] = await connection.query(
        `UPDATE scenario_characters
         SET learner_detail = ?, emoji = ?
         WHERE scenario_id IN (1, 2) AND card_number = ?`,
        [JSON.stringify(c.learnerDetail), c.emoji, c.cardNumber]
      );
      console.log(`[BACKFILL] Case1&2 card_number=${c.cardNumber} → ${r.affectedRows}행 갱신`);
    }

    // 3. Case 3 캐릭터 백필 (scenario_id=4)
    for (const c of CASE3_CHAR_UPDATES) {
      const [r] = await connection.query(
        `UPDATE scenario_characters
         SET learner_detail = ?, emoji = ?
         WHERE scenario_id = 4 AND card_number = ?`,
        [JSON.stringify(c.learnerDetail), c.emoji, c.cardNumber]
      );
      console.log(`[BACKFILL] Case3 card_number=${c.cardNumber} → ${r.affectedRows}행 갱신`);
    }

    // 4. 검증
    const [scenarios] = await connection.query(
      'SELECT id, learner_role, LEFT(learner_brief, 30) AS brief_preview FROM scenarios WHERE id IN (1,2,4)'
    );
    console.log('[BACKFILL] 시나리오 검증:', scenarios);

    const [chars] = await connection.query(
      `SELECT sc.scenario_id, sc.card_number, sc.name, sc.emoji,
              JSON_VALID(sc.learner_detail) AS detail_valid
       FROM scenario_characters sc
       WHERE sc.scenario_id IN (1,2,4)
       ORDER BY sc.scenario_id, sc.card_number`
    );
    const invalidDetail = chars.filter(c => !c.detail_valid);
    if (invalidDetail.length > 0) {
      console.error('[BACKFILL] ❌ learner_detail JSON 유효성 오류:', invalidDetail);
      process.exit(1);
    }
    console.log(`[BACKFILL] 캐릭터 검증: ${chars.length}명 전원 emoji + learner_detail 정상`);
    chars.forEach(c => console.log(`  scenario=${c.scenario_id} card=${c.card_number} ${c.name} emoji=${c.emoji}`));

    console.log('[BACKFILL] ✅ Phase C v3 detail-backfill 완료 — 시나리오 3건, 캐릭터 18명');
  } catch (err) {
    console.error('[BACKFILL] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

backfill();
