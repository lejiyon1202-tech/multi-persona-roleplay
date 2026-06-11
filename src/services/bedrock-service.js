// 13번째 원칙: AWS SDK v3 공식 docs 확인 후 작성
// Ref: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/
// anthropic_version 표준값: 'bedrock-2023-05-31'
// Ref: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html
// 자기반성 2026-06-01 KST: 'bedrock-2023-06-01' 추정 작성 → 공식 docs fetch 후 'bedrock-2023-05-31' 정정 (13번째 원칙)
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const REGION   = process.env.AWS_REGION || 'ap-northeast-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'jp.anthropic.claude-sonnet-4-6';

const client = new BedrockRuntimeClient({ region: REGION });

function buildBody(messages, systemPrompt, maxTokens = 1024) {
  return JSON.stringify({
    // 공식 표준값 — Ref: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });
}

/**
 * 스트리밍 채팅 — SSE 청크를 yield
 * @param {Array}  messages     [{role, content}]
 * @param {string} systemPrompt 캐릭터 페르소나 + 상황 설명
 */
export async function* invokeChat(messages, systemPrompt) {
  const command = new InvokeModelWithResponseStreamCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: buildBody(messages, systemPrompt, 1024),
  });

  const response = await client.send(command);

  for await (const event of response.body) {
    if (event.chunk?.bytes) {
      const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }
}

/**
 * Phase E B안: 반응 캐릭터 선별 LLM 호출 (non-streaming)
 * @param {string}   userMessage  학습자 발화
 * @param {Array}    characters   [{id, name, role_level, core_mindset}]
 * @param {Array}    history      최근 대화 이력 [{role, content}] (최대 6개)
 * @returns {number[]} 반응할 캐릭터 ID 배열 (빈 배열 = 전체 0명·fallback 필요)
 */
export async function invokeSelectResponders({ userMessage, characters, history = [] }) {
  const charList = characters.map(c =>
    `- ID:${c.id} ${c.name}(${c.role_level})${c.core_mindset ? ': ' + c.core_mindset.slice(0, 60) : ''}`
  ).join('\n');

  const systemPrompt = `당신은 그룹 메신저 채팅에서 누가 반응할지 결정하는 역할입니다.
학습자의 발화와 대화 맥락을 보고, 아래 캐릭터 중 이 발화에 자연스럽게 반응할 캐릭터를 선별하세요.

[선별 기준]
1. 학습자가 전체에게 의견을 묻거나 토론·회의를 유도하는 발화(예: "다들 어떻게 생각하세요", "의견 주세요", "이 안건 같이 논의합시다", "회의 시작하죠") → **참석자 전원 선별**
2. 학습자가 특정 캐릭터를 지목·언급 → 해당 캐릭터 반드시 포함 + 그와 직접 갈등·이해관계가 있는 캐릭터도 함께 포함
3. 업무·갈등 상황에 직접 관련된 캐릭터 우선
4. 감정적으로 반응할 맥락인 캐릭터 포함
5. 반응 순서: 직접 언급 > 감정 강한 순 (기계적 순서 회피)
6. 특정 캐릭터의 침묵도 자연스러울 수 있음 — 전체 0명일 때만 fallback 적용
7. 1:1 성격의 사적 발화는 과도하게 전원 선별하지 말 것 (토론·전체 안건일 때만 전원)
8. 같은 맥락에서 유사하게 선별하되 완전히 결정적이지 않게 (소폭 변동 허용)

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력. reasoning은 10단어 이내로 짧게:
{"responders": [캐릭터ID배열], "reasoning": "10단어 이내"}`;

  const messages = [
    ...history.slice(-4).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    {
      role: 'user',
      content: `학습자 발화: "${userMessage}"\n\n[캐릭터 목록]\n${charList}\n\n위 캐릭터 중 이 발화에 반응할 캐릭터 ID를 선별하세요.`,
    },
  ];

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: buildBody(messages, systemPrompt, 1024),
  });

  try {
    const response = await client.send(command);
    const raw  = JSON.parse(new TextDecoder().decode(response.body));
    const text = raw.content?.[0]?.text ?? '';
    console.log('[SELECT raw]', text.slice(0, 300));
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) { console.error('[SELECT] JSON 파싱 실패 — jsonMatch null'); return []; }
    const parsed = JSON.parse(jsonMatch[0]);
    const ids = Array.isArray(parsed.responders)
      ? parsed.responders.map(Number).filter(n => n > 0)
      : [];
    console.log(`[SELECT] reasoning: ${parsed.reasoning ?? ''} → responders: [${ids}]`);
    return ids;
  } catch (err) {
    console.error('[SELECT] 선별 LLM 오류 — fallback 빈 배열:', err.message);
    return [];
  }
}

/**
 * 평가 (non-streaming) — JSON 응답 반환
 * @param {string} transcript      세션 대화 내용 (텍스트)
 * @param {string} evalPrompt      평가 프롬프트 (채점 기준 포함)
 */
export async function invokeEvaluate(transcript, evalPrompt, maxTokens = 4096) {
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: buildBody(
      [{ role: 'user', content: transcript }],
      evalPrompt,
      maxTokens
    ),
  });

  const response = await client.send(command);
  const raw = JSON.parse(new TextDecoder().decode(response.body));
  const text = raw.content?.[0]?.text ?? '';

  const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) || text.match(/(\{[\s\S]+\})/);
  if (!jsonMatch) throw new Error('[BEDROCK] 평가 JSON 파싱 실패');
  return JSON.parse(jsonMatch[1]);
}
