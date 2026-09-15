import { createRoot, hydrateRoot, type Root } from 'react-dom/client';

import PublicHostProfileImage from '../../../app/components/PublicHostProfileImage';

export type ProfileHarnessConfiguration = {
  hostId: string;
  originImageUrl: string;
};

declare global {
  interface Window {
    publicHostProfileHarness: {
      hydrate(configuration: ProfileHarnessConfiguration): void;
      mount(configuration: ProfileHarnessConfiguration): void;
      update(configuration: ProfileHarnessConfiguration): void;
    };
  }
}

let root: Root | null = null;

function Harness(configuration: ProfileHarnessConfiguration) {
  return <PublicHostProfileImage {...configuration} alt="Profile fixture" sizes="128px" loading="eager" />;
}

window.publicHostProfileHarness = {
  hydrate(configuration) {
    root = hydrateRoot(document.getElementById('root')!, <Harness {...configuration} />);
  },
  mount(configuration) {
    root = createRoot(document.getElementById('root')!);
    root.render(<Harness {...configuration} />);
  },
  update(configuration) {
    if (!root) throw new Error('Profile harness must be mounted first.');
    root.render(<Harness {...configuration} />);
  },
};
