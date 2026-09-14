import { createRoot, hydrateRoot, type Root } from 'react-dom/client';

import PublicExperienceCardImage from '../../../app/components/PublicExperienceCardImage';
import PublicExperienceDetailImage from '../../../app/components/PublicExperienceDetailImage';

type ReaderHarnessConfiguration = {
  kind: 'card' | 'detail';
  experienceId: number | string;
  originImageUrl: string;
  r2Eligible: boolean;
};

declare global {
  interface Window {
    publicExperienceMediaReaderHarness: {
      hydrate(configuration: ReaderHarnessConfiguration): void;
      mount(configuration: ReaderHarnessConfiguration): void;
      update(configuration: ReaderHarnessConfiguration): void;
    };
  }
}

let root: Root | null = null;

function ReaderHarness(configuration: ReaderHarnessConfiguration) {
  const sharedProps = {
    experienceId: configuration.experienceId,
    originImageUrl: configuration.originImageUrl,
    r2Eligible: configuration.r2Eligible,
    alt: 'Public experience media fixture',
    sizes: configuration.kind === 'card' ? '640px' : '960px',
    className: 'fixture-image',
  };

  return configuration.kind === 'card'
    ? <PublicExperienceCardImage {...sharedProps} />
    : <PublicExperienceDetailImage {...sharedProps} />;
}

window.publicExperienceMediaReaderHarness = {
  hydrate(configuration) {
    root = hydrateRoot(document.getElementById('root')!, <ReaderHarness {...configuration} />);
  },
  mount(configuration) {
    root = createRoot(document.getElementById('root')!);
    root.render(<ReaderHarness {...configuration} />);
  },
  update(configuration) {
    if (!root) throw new Error('Reader harness must be mounted before it can be updated.');
    root.render(<ReaderHarness {...configuration} />);
  },
};
