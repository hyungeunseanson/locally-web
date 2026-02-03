// ... (기존 imports)
// ... (컴포넌트 내부)

const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('로그인이 필요합니다.');
    
    // inquiryText state 필요
    const { error } = await supabase.from('inquiries').insert([{
      experience_id: experience.id,
      host_id: experience.host_id,
      user_id: user.id,
      content: inquiryText // useState로 관리 필요
    }]);

    if (!error) {
      alert('호스트에게 메시지를 보냈습니다!');
      setInquiryText('');
    }
  };

// ... (return 문 내부)
  
  {/* 문의하기 섹션 추가 */}
  <div className="mt-12 border-t pt-8">
    <h3 className="text-xl font-bold mb-4">호스트에게 문의하기</h3>
    <textarea 
      className="w-full border p-4 rounded-xl h-24 mb-4 resize-none"
      placeholder="체험에 대해 궁금한 점을 물어보세요."
      value={inquiryText}
      onChange={(e) => setInquiryText(e.target.value)}
    />
    <button onClick={handleInquiry} className="px-6 py-3 border border-slate-300 rounded-xl font-bold hover:bg-slate-50">
      메시지 보내기
    </button>
  </div>