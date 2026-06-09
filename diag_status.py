import json, ssl, urllib.request, sys, io

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8','utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = "https://persona.3.39.80.158.nip.io"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def api_get(path):
    req = urllib.request.Request(f"{BASE}/api{path}")
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}
    except Exception as e:
        return None, str(e)

# 세션 28, 29 report로 status 확인
for sid in [28, 29]:
    st, body = api_get(f"/sessions/{sid}/report")
    if st == 200:
        sess = body.get("session", {})
        print(f"session {sid}: status={sess.get('status')} learner_id={sess.get('learner_id')} scenario_id={sess.get('scenario_id')} character_id={sess.get('character_id')} learner_char_id={sess.get('learner_character_id')} dialogue_partner_ids={sess.get('dialogue_partner_ids')}")
        ev = body.get("evaluation")
        print(f"  evaluation: {ev is not None} grade={ev.get('grade') if ev else None}")
    else:
        print(f"session {sid}: HTTP {st} {body}")

# compare 다시 호출 (learner_id=13)
st2, cmp = api_get("/sessions/compare?learner_id=13&scenario_id=1")
print(f"\ncompare learner_id=13 scenario_id=1: HTTP {st2}")
if st2 == 200:
    print("  sessions:", len(cmp.get("sessions", [])))
else:
    print("  error:", cmp)
