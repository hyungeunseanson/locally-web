/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- browser fixture for the real reader components */
import type { ImgHTMLAttributes } from 'react';

type NextImageStubProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  quality?: number;
  unoptimized?: boolean;
};

export default function NextImageStub({
  fill: _fill,
  quality: _quality,
  unoptimized: _unoptimized,
  ...imageProps
}: NextImageStubProps) {
  void _fill;
  void _quality;
  void _unoptimized;
  return <img {...imageProps} />;
}
