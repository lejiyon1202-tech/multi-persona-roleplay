# 캐릭터 아바타 생성 프롬프트 (gpt-image-1) — v2 다양성 강화

> 생성일: 2026-06-11 · 도구: OpenAI Images API (gpt-image-1) · 한국인 비즈니스 프로필 헤드샷
> v2 변경: 대장님 "다 비슷/머리 똑같다" 피드백 반영 → **헤어를 첫 디스크립터로** + 6차원 변주(헤어·복장직급차등·연령시각차·표정성격·각도·배경)
> 개별 재생성 시 아래 프롬프트 + 공통 접미사 사용. char-7~12 = char-1~6 동일 인물(복사).

**공통 접미사:** `, realistic professional corporate portrait, photorealistic, head and shoulders, each person looks clearly distinct individual`

> 💡 헤어 명시를 **프롬프트 맨 앞**에 둘 것 — gpt-image는 첫 디스크립터 가중치가 높아 헤어 구별성이 확실해진다.

| char | 인물 | 직급 | 성별/연령 | 헤어 | 프롬프트(접미사 제외) |
|------|------|------|----------|------|----------------------|
| 1 (=7) | 이임원 | 상위리더 | 남·55 | 반백 스웹백 | Thick salt-and-pepper hair swept back, deep forehead wrinkles, Korean male executive aged 55, full navy pinstripe suit with burgundy tie, stern authoritative expression, front view, clean white studio background |
| 2 (=8) | 김센터 | 그룹장 | 남·40대 | 검은 가르마 | Neat black side-parted hair with clean parting line, Korean male manager mid 40s, gray blazer no tie open collar, warm composed slight smile, three-quarter side angle, blurred office background |
| 3 (=9) | 박수석 | 파트장 | 남·40대 | 곱슬+안경 | Short curly wavy black hair, glasses, Korean male team leader early 40s, light blue shirt with knit vest, serious principled intellectual expression, front view, warm beige background |
| 4 (=10) | 박보안 | 파트장 | 남·30대후 | 투블럭 | Modern two-block undercut hairstyle shaved sides, Korean male team leader late 30s, navy dress shirt no jacket, calm slightly weary expression, three-quarter side angle, cool gray background |
| 5 (=11) | 이책임 | 부서원 | 남·30대 | 버즈컷+안경 | Very short buzz cut cropped hair, thin-framed glasses, Korean male engineer mid 30s, casual dark gray knit sweater, calm practical expression, front view, soft green-gray background |
| 6 (=12) | 정인라 | 부서원 | 여·20대후 | 긴생머리 | Long straight black hair past shoulders, Korean young woman late 20s, light blouse with beige cardigan, quiet reserved youthful expression, slight side angle, bright white background |
| 13 | 오현철 | CCO | 남·50대후 | M자 대머리·반백 | Balding head with M-shaped receding thin gray hairline, age spots, Korean senior male executive late 50s, premium black suit silver tie, dignified weathered authoritative expression, front view, dark gradient gray background |
| 14 | 최준호 | 본부장 | 남·40대 | 슬릭백 광택 | Glossy jet-black hair slicked straight back wet-look, Korean male division head mid 40s, blue blazer no tie, cautious guarded expression, three-quarter side angle, warm toned background |
| 15 | 강민경 | 팀장 | 여·40대 | 단발 밥 | Shoulder-length bob haircut, Korean businesswoman 40s, dark blazer with blouse, determined confident assertive expression, front view, soft gray background |
| 16 | 박기훈 | 팀장 | 남·40대후 | 반백 짧은컷+안경 | Short cropped salt-and-pepper hair gray at temples, rectangular glasses, Korean male manager late 40s, charcoal jacket open collar, serious responsible thoughtful expression, slight side angle, office window natural light |
| 17 | 윤서준 | 수석 | 남·30대 | 트렌디 앞머리 | Trendy textured comma-shaped fringe young hairstyle, Korean young male analyst early 30s, light blue dress shirt sleeves rolled up, sharp analytical cool expression, front view, clean white background |
| 18 | 이동현 | 책임 | 남·40대 | 헝클+수염 | Medium-length tousled messy hair with light stubble beard, Korean male specialist early 40s, navy turtleneck under casual blazer, tired cynical weary expression, three-quarter side angle, cool gray background |

## 라이선스
- OpenAI gpt-image-1 생성물 — 권리 사용자 귀속·상업 이용 가능 (워터마크 없음)
- 기존 thispersondoesnotexist.com(StyleGAN 서양인) 자산 전면 교체

## 변주 6차원 (재생성 시 유지)
1. **헤어**(첫 디스크립터·12명 전원 다름) 2. 복장(직급 차등: 임원=풀정장 / 팀장=자켓·셔츠 / 부서원=니트·터틀넥·캐주얼) 3. 연령 시각차(50대 흰머리·주름 / 30대 젊게) 4. 표정(캐릭터 성격 반영) 5. 각도(정면/반측면 혼합) 6. 배경(화이트·오피스블러·베이지·웜톤·창가 분산)
