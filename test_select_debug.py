"""invokeSelectResponders 선별 결과를 SSE data 이벤트로 직접 확인
sessions.js:159 형식: data: {"character_id": N, "character_name": "..."}  (event: 없음)
"""
import urllib.request, json, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE = 'https://persona.3.39.80.158.nip.io'

# 새 세션 생성
body = json.dumps({
    'learner_id': 1,
    'scenario_id': 1,
    'learner_character_id': 3,
    'dialogue_partner_ids': [4, 5, 6]
}).encode()
req = urllib.request.Request(
    f'{BASE}/api/sessions', data=body,
    headers={'Content-Type': 'application/json'}, method='POST'
)
with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
    sess = json.loads(r.read())
sid = sess['session_id']
print(f'session_id={sid}')

turns = [
    '팀장님, 이번 AI 도입 건은 어떻게 생각하세요?',
    '팀 전체적으로 업무 방향을 어떻게 잡아야 할까요?',
    '솔직히 말하면, 이 방향에 동의하기 어렵습니다.',
]

for i, msg in enumerate(turns, 1):
    print(f'\n=== Turn {i}: {msg[:30]}... ===')
    payload = json.dumps({
        'session_id': sid,
        'message': msg,
        'learner_character_id': 3,
        'dialogue_partner_ids': [4, 5, 6]
    }).encode()
    req2 = urllib.request.Request(
        f'{BASE}/api/chat', data=payload,
        headers={'Content-Type': 'application/json'}, method='POST'
    )

    char_events = []   # {"character_id": N, "character_name": "..."}
    done_events = []
    all_events = []

    try:
        with urllib.request.urlopen(req2, timeout=120, context=ctx) as r:
            buf = ''
            while True:
                chunk = r.read(512)
                if not chunk:
                    break
                buf += chunk.decode('utf-8', errors='replace')
                while '\n\n' in buf:
                    idx = buf.index('\n\n')
                    block = buf[:idx].strip()
                    buf = buf[idx+2:]
                    if not block:
                        continue
                    for line in block.split('\n'):
                        if line.startswith('data:'):
                            raw = line[5:].strip()
                            try:
                                obj = json.loads(raw)
                                all_events.append(obj)
                                if 'character_id' in obj and 'character_name' in obj and 'done' not in obj:
                                    char_events.append(obj)
                                    print(f'  [CHAR SELECT] character_id={obj["character_id"]} name={obj["character_name"]}')
                                elif obj.get('done'):
                                    done_events.append(obj)
                            except:
                                pass
    except Exception as e:
        print(f'  오류: {e}')

    selected = [e['character_id'] for e in char_events]
    print(f'  --> 선별된 character_id 이벤트 {len(char_events)}개: {selected}')
    if not char_events:
        print(f'  --> 전체 이벤트 수: {len(all_events)} (character_id 이벤트 없음 = fallback or 파싱 문제)')

print('\n=== 완료 ===')
