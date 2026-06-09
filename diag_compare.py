import json, ssl, urllib.request, sys, io

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8','utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = "https://persona.3.39.80.158.nip.io"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def api_get(path):
    req = urllib.request.Request(f"{BASE}/api{path}")
    with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
        return json.loads(r.read().decode("utf-8"))

def api_post(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/api{path}", data=data,
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def do_chat(sid, msg, target_id):
    body = json.dumps({"session_id": sid, "message": msg, "target_character_id": target_id}).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/chat", data=body,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
        for raw in r:
            line = raw.decode("utf-8", errors="replace").strip()
            if line.startswith("data:"):
                obj = json.loads(line[5:].strip())
                if obj.get("done"):
                    return obj.get("character_id")
    return None

# 학습자 등록
_, lr = api_post("/learners", {"name": "진단테스터", "email": "diag@test.local"})
lid = lr["id"]
print(f"learner_id: {lid}")

learner_char_id = 2  # 그룹장

# === 세션 1 ===
st1, s1 = api_post("/sessions", {
    "learner_id": lid, "scenario_id": 1,
    "learner_character_id": learner_char_id,
    "dialogue_partner_ids": [3]
})
sid1 = s1.get("session_id")
print(f"session1: status={st1} id={sid1}")

# 채팅 1턴
cid = do_chat(sid1, "안녕하세요", 3)
print(f"chat1 done char_id={cid}")

# 평가
st_e1, ev1 = api_post("/evaluate", {"session_id": sid1})
print(f"eval1: status={st_e1} total_score={ev1.get('total_score')}")

# === 세션 2 ===
st2, s2 = api_post("/sessions", {
    "learner_id": lid, "scenario_id": 1,
    "learner_character_id": learner_char_id,
    "dialogue_partner_ids": [4]
})
sid2 = s2.get("session_id")
print(f"session2: status={st2} id={sid2}")

# 채팅 1턴
cid2 = do_chat(sid2, "안녕하세요", 4)
print(f"chat2 done char_id={cid2}")

# 평가
st_e2, ev2 = api_post("/evaluate", {"session_id": sid2})
print(f"eval2: status={st_e2} total_score={ev2.get('total_score')}")

# === compare ===
try:
    cmp = api_get(f"/sessions/compare?learner_id={lid}&scenario_id=1")
    sessions = cmp.get("sessions", [])
    print(f"compare SUCCESS: {len(sessions)} sessions")
    for s in sessions:
        print(f"  sid={s.get('session_id')} char_id={s.get('character_id')} name={s.get('character_name')} grade={s.get('grade')}")
except urllib.error.HTTPError as e:
    body = json.loads(e.read().decode("utf-8"))
    print(f"compare FAIL {e.code}: {body}")
except Exception as e:
    print(f"compare ERROR: {e}")
