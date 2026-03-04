import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * 게시글 본문을 바탕으로 친근하고 자연스러운 짧은 댓글(1~2줄) 생성
 */
export async function generateFriendlyComment(postContent: string, postTitle: string): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
너는 일본 여행 커뮤니티의 활발하고 친근한 유저야. 다음 게시글을 읽고, 도움이 될 만한 친절하고 짧은 한국어 댓글 1~2문장을 작성해줘.
조건:
1. 너무 로봇 같지 않게 일상 대화처럼 작성할 것 (해요체/합쇼체 혼용).
2. 이모지를 1~2개 정도 자연스럽게 사용할 것.
3. 게시물이 부정적이거나 클레임, 시스템 오류 문의면 빈 문자열('')을 반환할 것.
4. 인사말("안녕하세요" 등)로 시작하지 말고 바로 본론으로 리액션할 것.

[게시글 제목]
${postTitle}

[게시글 본문]
${postContent}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // 할루시네이션 방지: 부정적 프롬프트 조건에 의해 빈 문자열을 반환했을 경우 처리
    if (!text || text.length < 5 || text.includes("'")) {
        return '';
    }

    return text.replace(/^["']|["']$/g, ''); // 앞뒤 따옴표 제거
}

/**
 * 매일 새로운 현지 꿀팁/날씨 관련 커뮤니티 게시글 생성
 */
export async function generateAutoPost(): Promise<{ title: string; content: string; category: string }> {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
너는 일본(도쿄, 오사카, 후쿠오카, 삿포로 중 한 곳) 현지에 거주하는 친근한 한국인 가이드야. 
여행자 커뮤니티에 올릴 '오늘의 현지 날씨/옷차림 꿀팁' 또는 '가벼운 로컬 맛집 추천' 중 하나를 골라서 게시글을 작성해줘.

조건:
1. 제목과 본문을 JSON 포맷으로 반환해.
2. 제목은 30자 이내로 시선을 끄는 이모지를 포함해.
3. 본문은 200~400자 사이로 생생하고 구체적인 로컬 정보를 담아줘. (단락 구분 명확히)
4. 너무 형식적인 존댓말보다는 커뮤니티에 어울리는 친근한 '-해요/합니다'체 사용.

JSON 형식:
{
  "title": "게시글 제목",
  "content": "게시글 본문",
  "category": "info" // info 카테고리 고정
}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Markdown 코드 블록(```json ... ```) 제거
    if (text.startsWith('```json')) {
        text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (text.startsWith('```')) {
        text = text.replace(/^```/, '').replace(/```$/, '').trim();
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        // Fallback for parsing error
        console.error('Failed to parse Gemini JSON output:', text);
        return {
            title: '오늘 일본 날씨 너무 좋네요! ☀️',
            content: '지금 여행 중이신 분들, 옷차림 가볍게 하시고 즐거운 여행 되시길 바라요! 걷기 딱 좋은 날씨입니다.',
            category: 'info'
        };
    }
}
