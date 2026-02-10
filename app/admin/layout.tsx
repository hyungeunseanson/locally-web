import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import Sidebar from "@/app/admin/dashboard/components/Sidebar"; // 1. 사이드바 컴포넌트 불러오기

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();

  // Supabase 서버 클라이언트 생성
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 쿠키 설정 무시 (미들웨어가 처리함)
          }
        },
      },
    }
  );

  // 2. 현재 로그인한 사용자 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login"); // 로그인 안 했으면 로그인 페이지로 보냄
  }

  // 3. DB에서 진짜 관리자인지 확인 (보안 핵심)
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // 관리자가 아니면 메인 홈페이지로 쫓아냄
  if (!userProfile || userProfile.role !== "admin") {
    redirect("/");
  }

  // 4. 레이아웃 구성 (사이드바 + 메인 콘텐츠)
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* 왼쪽: 고정된 관리자 사이드바 */}
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>

      {/* 오른쪽: 바뀌는 페이지 내용 (대시보드, 예약관리 등) */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}