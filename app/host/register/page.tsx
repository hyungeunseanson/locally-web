'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/context/ToastContext';
import HostRegisterForm from './components/HostRegisterForm';
import {
  type LanguageLevel,
  type LanguageLevelEntry,
  getLanguageNames,
  normalizeLanguageLevels,
} from '@/app/utils/languageLevels';
import { compressImage } from '@/app/utils/image'; // 🟢 이미지 압축 추가

type HostRegisterFormData = {
  languageLevels: LanguageLevelEntry[];
  languageCert: string;
  name: string;
  phone: string;
  dob: string;
  email: string;
  instagram: string;
  source: string;
  profilePhoto: string | null;
  selfIntro: string;
  idCardFile: string | null;
  hostNationality: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  motivation: string;
  agreeTerms: boolean;
  educationCompleted: boolean;
  agreeSafetyPolicy: boolean;
};

const INITIAL_FORM_DATA: HostRegisterFormData = {
  languageLevels: [],
  languageCert: '',
  name: '',
  phone: '',
  dob: '',
  email: '',
  instagram: '',
  source: '',
  profilePhoto: null,
  selfIntro: '',
  idCardFile: null,
  hostNationality: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  motivation: '',
  agreeTerms: false,
  educationCompleted: false,
  agreeSafetyPolicy: false,
};

function getFallbackLevel(value: unknown): LanguageLevel {
  const parsed = Number(value);
  if (parsed >= 1 && parsed <= 5) {
    return parsed as LanguageLevel;
  }
  return 3;
}

export default function HostRegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const totalSteps = 8;
  const [loading, setLoading] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [existingApplicationStatus, setExistingApplicationStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState<HostRegisterFormData>(INITIAL_FORM_DATA);
  const [files, setFiles] = useState<{ profile?: File; idCard?: File }>({});

  useEffect(() => {
    const fetchExistingData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;

      setApplicationId(data.id);
      setExistingApplicationStatus(data.status || null);
      setFormData((prev) => ({
        ...prev,
        languageLevels: normalizeLanguageLevels(
          data.language_levels,
          Array.isArray(data.languages) ? data.languages : data.target_language ? [data.target_language] : [],
          getFallbackLevel(data.language_level)
        ),
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
        agreeTerms: true,
        educationCompleted: true,
        agreeSafetyPolicy: true,
      }));
    };

    fetchExistingData();
  }, []);

  const updateData = (key: keyof HostRegisterFormData, value: HostRegisterFormData[keyof HostRegisterFormData]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleLanguage = (language: string) => {
    setFormData((prev) => {
      const exists = prev.languageLevels.some((entry) => entry.language === language);
      return {
        ...prev,
        languageLevels: exists
          ? prev.languageLevels.filter((entry) => entry.language !== language)
          : [...prev.languageLevels, { language, level: 3 }],
      };
    });
  };

  const updateLanguageLevel = (language: string, level: LanguageLevel) => {
    setFormData((prev) => ({
      ...prev,
      languageLevels: prev.languageLevels.map((entry) =>
        entry.language === language ? { ...entry, level } : entry
      ),
    }));
  };

  const validateNextStep = () => {
    if (step !== 2) return true;
    if (formData.languageLevels.length < 1) {
      showToast('구사 가능한 언어를 1개 이상 선택해주세요.', 'error');
      return false;
    }
    if (formData.languageLevels.some((entry) => entry.level < 1 || entry.level > 5)) {
      showToast('선택한 각 언어의 레벨을 설정해주세요.', 'error');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (step >= totalSteps) return;
    if (!validateNextStep()) return;
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep((prev) => prev - 1);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'profile' | 'idCard') => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    updateData(fieldName === 'profile' ? 'profilePhoto' : 'idCardFile', url);
    setFiles((prev) => ({ ...prev, [fieldName]: file }));
  };

  const handleSubmit = async () => {
    if (!formData.agreeTerms || !formData.educationCompleted || !formData.agreeSafetyPolicy) {
      showToast('모든 필수 교육 시청 및 서약에 동의해주세요.', 'error');
      return;
    }
    if (formData.languageLevels.length < 1) {
      showToast('구사 가능한 언어를 1개 이상 선택해주세요.', 'error');
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      let profileUrl = formData.profilePhoto;
      let idCardUrl = formData.idCardFile;

      if (files.profile) {
        const compressedProfile = await compressImage(files.profile); // 🟢 압축 추가
        const fileName = `profile/${user.id}_${Date.now()}`;
        const { error } = await supabase.storage.from('images').upload(fileName, compressedProfile);
        if (!error) {
          const { data } = supabase.storage.from('images').getPublicUrl(fileName);
          profileUrl = data.publicUrl;
        }
      }

      if (files.idCard) {
        const compressedIdCard = await compressImage(files.idCard); // 🟢 압축 추가
        const fileName = `id_card/${user.id}_${Date.now()}`;
        // 🟢 신분증은 보안 버킷인 verification-docs로 업로드합니다.
        const { error } = await supabase.storage.from('verification-docs').upload(fileName, compressedIdCard);
        if (!error) {
          // 보안 버킷이므로 PublicURL 대신 파일명(경로)만 저장하여 DetailsPanel에서 추출 및 서명된 URL 발급할 수 있게 함
          idCardUrl = fileName;
        }
      }

      const languageNames = getLanguageNames(formData.languageLevels);

      const payload = {
        user_id: user.id,
        host_nationality: formData.hostNationality,
        languages: languageNames,
        language_levels: formData.languageLevels,
        name: formData.name,
        phone: formData.phone,
        dob: formData.dob,
        email: formData.email,
        instagram: formData.instagram,
        source: formData.source,
        language_cert: formData.languageCert,
        profile_photo: profileUrl,
        self_intro: formData.selfIntro,
        id_card_file: idCardUrl,
        bank_name: formData.bankName,
        account_number: formData.accountNumber,
        account_holder: formData.accountHolder,
        motivation: formData.motivation,
        status: applicationId && existingApplicationStatus === 'approved' ? 'approved' : 'pending',
      };

      const { error } = applicationId
        ? await supabase.from('host_applications').update(payload).eq('id', applicationId)
        : await supabase.from('host_applications').insert([payload]);

      if (error) throw error;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          languages: languageNames,
          bio: formData.selfIntro,
          full_name: formData.name,
          avatar_url: profileUrl,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      showToast('신청이 완료되었습니다! 관리자 승인을 기다려주세요.', 'success');
      router.push('/host/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      console.error(error);
      showToast('신청 중 오류가 발생했습니다: ' + message, 'error');
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
      updateLanguageLevel={updateLanguageLevel}
      handlePhotoUpload={handlePhotoUpload}
      prevStep={prevStep}
      nextStep={nextStep}
      handleSubmit={handleSubmit}
      loading={loading}
    />
  );
}
