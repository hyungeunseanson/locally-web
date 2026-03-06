import Image from 'next/image';

const DESKTOP_CONTENT = {
  main: {
    src: '/images/become-host2/main-desktop.webp',
    width: 1705,
    height: 6500,
    alt: 'Locally become-a-host2 desktop reference main layout',
  },
  faq: {
    src: '/images/become-host2/faq-desktop.webp',
    width: 1705,
    height: 1030,
    alt: 'Locally become-a-host2 desktop reference FAQ layout',
  },
} as const;

export default function BecomeHost2Page() {
  return (
    <div className="min-h-screen bg-[#efefef] text-[#222222]">
      <main className="bg-[#efefef]">
        <div className="mx-auto flex w-full max-w-[1705px] flex-col items-center">
          <Image
            src={DESKTOP_CONTENT.main.src}
            alt={DESKTOP_CONTENT.main.alt}
            width={DESKTOP_CONTENT.main.width}
            height={DESKTOP_CONTENT.main.height}
            priority
            sizes="(max-width: 1705px) 100vw, 1705px"
            className="h-auto w-full max-w-[1705px]"
          />
          <Image
            src={DESKTOP_CONTENT.faq.src}
            alt={DESKTOP_CONTENT.faq.alt}
            width={DESKTOP_CONTENT.faq.width}
            height={DESKTOP_CONTENT.faq.height}
            sizes="(max-width: 1705px) 100vw, 1705px"
            className="h-auto w-full max-w-[1705px]"
          />
        </div>
      </main>
    </div>
  );
}
