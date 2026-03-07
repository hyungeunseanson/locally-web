import Image from "next/image";

const sections = [
    { src: "/images/become-a-host2/1.png", alt: "Become a host design section 1", width: 2880, height: 1260 },
    { src: "/images/become-a-host2/2.png", alt: "Become a host design section 2", width: 2880, height: 1434 },
    { src: "/images/become-a-host2/3.png", alt: "Become a host design section 3", width: 2880, height: 1156 },
    { src: "/images/become-a-host2/4.png", alt: "Become a host design section 4", width: 2880, height: 1296 },
    { src: "/images/become-a-host2/5.png", alt: "Become a host design section 5", width: 2880, height: 1542 },
    { src: "/images/become-a-host2/6.png", alt: "Become a host design section 6", width: 2880, height: 1502 },
    { src: "/images/become-a-host2/7.png", alt: "Become a host design section 7", width: 2880, height: 2264 },
];

export default function BecomeAHost2Page(): JSX.Element {
    return (
        <main className="bg-white">
            <div className="mx-auto w-full max-w-[1440px]">
                {sections.map((section, index) => (
                    <Image
                        key={section.alt}
                        src={section.src}
                        alt={section.alt}
                        width={section.width}
                        height={section.height}
                        className="block h-auto w-full"
                        priority={index < 2}
                        sizes="(max-width: 1440px) 100vw, 1440px"
                        unoptimized
                    />
                ))}
            </div>
        </main>
    );
}
