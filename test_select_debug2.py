"""각 turn 후 즉시 DB 저장 확인 — char 5 addMessage 실패 여부"""
import urllib.request, json, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE = 'https://persona.3.39.80.158.nip.io'

def api_get(path):
    with urllib.request.urlopen(f'{BASE}{path}', timeout=10, context=ctx) as r:
        return json.loads(r.read())

def api_post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f'{BASE}{path}', data=data, headers={'Content-Type':'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
        return json.loads(r.read())

# 새 세션 생성
sess = api_post('/api/sessions', {'learner_id':1,'scenario_id':1,'learner_character_id':3,'dialogue_partner_ids':[4,5,6]})
sid = sess['session_id']
print(f'session_id={sid}')

def send_and_watch(sid, msg, turn_label):
    print(f'\n=== {turn_label}: {msg[:40]} ===')
    payload = json.dumps({'session_id':sid,'message':msg,'learner_character_id':3,'dialogue_partner_ids':[4,5,6]}).encode()
    req2 = urllib.request.Request(f'{BASE}/api/chat', data=payload, headers={'Content-Type':'application/json'}, method='POST')

    char_events = []
    done_events = []
    error_events = []

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
                            if 'character_id' in obj and 'character_name' in obj and 'done' not in obj:
                                char_events.append(obj)
                                print(f'  [CHAR START] char_id={obj["character_id"]} name={obj["character_name"]}')
                            elif obj.get('done'):
                                done_events.append(obj)
                                print(f'  [DONE] char_id={obj.get("character_id")}')
                            elif 'error' in obj:
                                error_events.append(obj)
                                print(f'  [ERROR] {obj}')
                        except:
                            pass

    print(f'  char_start={len(char_events)} done={len(done_events)} error={len(error_events)}')
    selected_start = [e['character_id'] for e in char_events]
    done_chars = [e['character_id'] for e in done_events]
    print(f'  char_start ids: {selected_start}')
    print(f'  done ids: {done_chars}')

    # 즉시 DB 확인
    time.sleep(0.5)
    data = api_get(f'/api/sessions/{sid}/messages')
    assistant_msgs = [m for m in data['messages'] if m['role'] == 'assistant']
    db_chars = [m['character_id'] for m in assistant_msgs]
    print(f'  DB messages total: {len(assistant_msgs)} char_ids={db_chars}')

    missing = set(selected_start) - set(done_chars)
    if missing:
        print(f'  ⚠ CHAR START 왔는데 DONE 없음: {missing} → invokeChat 오류 가능')
    if set(selected_start) != set(done_chars):
        print(f'  ⚠ start vs done 불일치')

send_and_watch(sid, '팀장님, 이번 AI 도입 건은 어떻게 생각하세요?', 'Turn 1 (인물 지목)')
send_and_watch(sid, '팀 전체적으로 업무 방향을 어떻게 잡아야 할까요?', 'Turn 2 (일반 질문)')
send_and_watch(sid, '솔직히 말하면, 이 방향에 동의하기 어렵습니다.', 'Turn 3 (갈등 유발)')

print('\n=== 최종 DB 상태 ===')
data = api_get(f'/api/sessions/{sid}/messages')
for m in data['messages']:
    print(f'  role={m["role"]} turn={m["turn_number"]} char_id={m["character_id"]}')
