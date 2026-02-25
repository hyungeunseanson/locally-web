import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReactNode, Suspense } from "react";
import Sidebar from "@/app/admin/dashboard/components/Sidebar";
import GlobalTeamChat from "@/app/admin/dashboard/components/GlobalTeamChat";

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
            // 서버 컴포넌트에서 쿠키 설정 무시
          }
        },
      },
    }
  );

  // 현재 로그인한 사용자 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // DB에서 진짜 관리자인지 확인 (보안 핵심: role 또는 whitelist 체크)
  const [userProfile, whitelistEntry] = await Promise.all([
    supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("admin_whitelist").select("id").eq("email", user.email || "").maybeSingle()
  ]);

  const isAdmin = (userProfile.data?.role === "admin") || !!whitelistEntry.data;

  // 관리자가 아니면 메인 홈페이지로 쫓아냄
  if (!isAdmin) {
    redirect("/");
  }

  // 화이트리스트에 있으나 권한이 admin이 아닌 경우 자동 승급 (DB RLS 우회 목적)
  if (whitelistEntry.data && userProfile.data?.role !== "admin") {
    // Service Role을 사용하여 RLS 제약을 무시하고 users 업데이트
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return []; },
          setAll() { }
        }
      }
    );
    await adminSupabase.from("users").update({ role: "admin" }).eq("id", user.id);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 왼쪽: 고정된 관리자 사이드바 (모바일에서 숨김 — Sidebar 내부에서 모바일 메뉴 처리) */}
      <div className="hidden md:block w-64 flex-shrink-0 bg-slate-900 min-h-screen sticky top-0">
        <Suspense fallback={<div className="h-full w-full bg-slate-800 animate-pulse" />}>
          <Sidebar />
        </Suspense>
      </div>

      {/* 🟢 모바일 전용: Sidebar를 오버레이로 마운트 (md 미만에서만 렌더) */}
      <div className="md:hidden">
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      </div>

      {/* 오른쪽: 바뀌는 페이지 내용 */}
      <main className="flex-1 p-2 pt-16 md:p-8 md:pt-8 overflow-y-auto h-screen scrollbar-hide pb-2 md:pb-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* 🟢 전역 팀 채팅창 마운트 */}
      <GlobalTeamChat />
    </div>
  );
}