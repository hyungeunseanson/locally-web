'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext'; // 🟢 Toast 훅 임포트
import HostRegisterForm from './components/HostRegisterForm';

export default function HostRegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast(); // 🟢 훅 사용
  
  const [step, setStep] = useState(1);
  const totalSteps = 8; 
  const [loading, setLoading] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    targetLanguages: [] as string[], 
    languageLevel: 3, 
    languageCert: '',
    name: '', phone: '', dob: '', email: '', instagram: '', source: '',
    profilePhoto: null as string | null,
    selfIntro: '',
    idCardType: '', 
    idCardFile: null as string | null,
    hostNationality: '',
    bankName: '', accountNumber: '', accountHolder: '',
    motivation: '', agreeTerms: false
  });
  
  const [files, setFiles] = useState<{ profile?: File, idCard?: File }>({});

  useEffect(() => {
    const fetchExistingData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setApplicationId(data.id);
        setFormData(prev => ({
          ...prev,
          targetLanguages: Array.isArray(data.languages) ? data.languages : (data.target_language ? [data.target_language] : []),
          languageLevel: data.language_level || 3,
          languageCert: data.language_cert || '',
          name: data.name || '',
          phone: data.phone || '',
          dob: data.dob || '',
          email: data.email || '',
          instagram: data.instagram || '',
          source: data.source || '',
          profilePhoto: data.profile_photo || null,
          selfIntro: data.self_intro || '',
          idCardFile: data.id_card_file || null,
          hostNationality: data.host_nationality || '',
          bankName: data.bank_name || '',
          accountNumber: data.account_number || '',
          accountHolder: data.account_holder || '',
          motivation: data.motivation || '',
          agreeTerms: true 
        }));
      }
    };
    fetchExistingData();
  }, []);

  const nextStep = () => { if (step < totalSteps) setStep(step + 1); };
  const prevStep = () => { if (step > 1) setStep(step - 1); };

  const updateData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleLanguage = (lang: string) => {
    const current = formData.targetLanguages;
    if (current.includes(lang)) {
      updateData('targetLanguages', current.filter(l => l !== lang));
    } else {
      updateData('targetLanguages', [...current, lang]);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'profile' | 'idCard') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      updateData(fieldName === 'profile' ? 'profilePhoto' : 'idCardFile', url);
      setFiles(prev => ({ ...prev, [fieldName]: file }));
    }
  };

  const handleSubmit = async () => {
    // 🟢 alert -> showToast (경고)
    if (!formData.agreeTerms) return showToast('약관에 동의해주세요.', 'error');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      let profileUrl = formData.profilePhoto; 
      let idCardUrl = formData.idCardFile;    

      if (files.profile) {
        const fileName = `profile/${user.id}_${Date.now()}`;
        const { error } = await supabase.storage.from('images').upload(fileName, files.profile);
        if (!error) {
          const { data } = supabase.storage.from('images').getPublicUrl(fileName);
          profileUrl = data.publicUrl;
        }
      }

      if (files.idCard) {
        const fileName = `id_card/${user.id}_${Date.now()}`;
        const { error } = await supabase.storage.from('images').upload(fileName, files.idCard);
        if (!error) {
          const { data } = supabase.storage.from('images').getPublicUrl(fileName);
          idCardUrl = data.publicUrl;
        }
      }

      const payload = {
        user_id: user.id,
        host_nationality: formData.hostNationality,
        languages: formData.targetLanguages,
        name: formData.name,
        phone: formData.phone,
        dob: formData.dob,
        email: formData.email,
        instagram: formData.instagram,
        source: formData.source,
        language_level: formData.languageLevel,
        language_cert: formData.languageCert,
        profile_photo: profileUrl,
        self_intro: formData.selfIntro,
        id_card_file: idCardUrl,
        bank_name: formData.bankName,
        account_number: formData.accountNumber,
        account_holder: formData.accountHolder,
        motivation: formData.motivation,
        status: 'pending'
      };

      let error;
      if (applicationId) {
        const res = await supabase.from('host_applications').update(payload).eq('id', applicationId);
        error = res.error;
      } else {
        const res = await supabase.from('host_applications').insert([payload]);
        error = res.error;
      }

      await supabase.from('profiles').update({ 
        languages: formData.targetLanguages,
        bio: formData.selfIntro,
        name: formData.name,
        role: 'host_pending',
        avatar_url: profileUrl
      }).eq('id', user.id);

      if (error) throw error;
      
      // 🟢 alert -> showToast (성공)
      showToast('신청이 완료되었습니다! 관리자 승인을 기다려주세요.', 'success');
      router.push('/host/dashboard');

    } catch (error: any) {
      console.error(error);
      // 🟢 alert -> showToast (에러)
      showToast('신청 중 오류가 발생했습니다: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <HostRegisterForm 
      step={step}
      totalSteps={totalSteps}
      formData={formData}
      updateData={updateData}
      toggleLanguage={toggleLanguage}
      handlePhotoUpload={handlePhotoUpload}
      prevStep={prevStep}
      nextStep={nextStep}
      handleSubmit={handleSubmit}
      loading={loading}
    />
  );
}