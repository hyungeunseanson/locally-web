'use client';

import React, { useState } from 'react';
import CommunityAuthorModal from './CommunityAuthorModal';

interface CommunityAuthorTriggerProps {
  userId?: string | null;
  authorName: string;
  isAnonymous?: boolean;
  currentPostId?: string;
  className?: string;
  children: React.ReactNode;
}

export default function CommunityAuthorTrigger({
  userId,
  authorName,
  isAnonymous = false,
  currentPostId,
  className,
  children,
}: CommunityAuthorTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isAnonymous || !userId) {
    return <div className={className}>{children}</div>;
  }

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={`${authorName} 프로필 보기`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        {children}
      </button>
      <CommunityAuthorModal
        userId={userId}
        currentPostId={currentPostId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
