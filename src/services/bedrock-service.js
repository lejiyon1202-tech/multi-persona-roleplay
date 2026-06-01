// 13번째 원칙: AWS SDK v3 공식 docs 확인 후 작성
// Ref: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/
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
    anthropic_version: 'bedrock-2023-06-01',
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
 * 평가 (non-streaming) — JSON 응답 반환
 * @param {string} transcript      세션 대화 내용 (텍스트)
 * @param {string} evalPrompt      평가 프롬프트 (채점 기준 포함)
 */
export async function invokeEvaluate(transcript, evalPrompt) {
  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: buildBody(
      [{ role: 'user', content: transcript }],
      evalPrompt,
      2048
    ),
  });

  const response = await client.send(command);
  const raw = JSON.parse(new TextDecoder().decode(response.body));
  const text = raw.content?.[0]?.text ?? '';

  const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) || text.match(/(\{[\s\S]+\})/);
  if (!jsonMatch) throw new Error('[BEDROCK] 평가 JSON 파싱 실패');
  return JSON.parse(jsonMatch[1]);
}
