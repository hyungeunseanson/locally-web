import { renderToString } from 'react-dom/server';

import PublicExperienceCardImage from '../../../app/components/PublicExperienceCardImage';
import PublicExperienceDetailImage from '../../../app/components/PublicExperienceDetailImage';

export type ReaderHarnessConfiguration = {
  kind: 'card' | 'detail';
  experienceId: number | string;
  originImageUrl: string;
  r2Eligible: boolean;
};

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

export function renderReaderHarness(configuration: ReaderHarnessConfiguration) {
  return renderToString(<ReaderHarness {...configuration} />);
}
