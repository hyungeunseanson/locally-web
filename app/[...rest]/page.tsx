import { notFound } from 'next/navigation';

export default function CatchAllPage() {
  // 이 페이지는 실제로 렌더링되지 않아야 합니다.
  // 미들웨어가 정상 작동하면 여기 도달하기 전에 rewrite 됩니다.
  // 만약 여기에 도달했다면, 정말 없는 페이지이므로 404를 띄웁니다.
  notFound();
}
