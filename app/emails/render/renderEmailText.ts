import { render } from '@react-email/render';
import type * as React from 'react';

export async function renderEmailText(node: React.ReactNode) {
  return render(node, { plainText: true });
}
