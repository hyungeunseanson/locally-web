import { renderToString } from 'react-dom/server';

import PublicHostProfileImage from '../../../app/components/PublicHostProfileImage';

export type ProfileHarnessConfiguration = {
  hostId: string;
  originImageUrl: string;
};

export function renderProfileHarness(configuration: ProfileHarnessConfiguration) {
  return renderToString(
    <PublicHostProfileImage {...configuration} alt="Profile fixture" sizes="128px" loading="eager" />
  );
}
