'use client';

import type { ReactNode } from 'react';
import { installZipApiFetch } from '@/lib/zip/api-origin.ts';

if (typeof window !== 'undefined') installZipApiFetch();

export default function CutoverRuntime({ children }: { children: ReactNode }) {
  if (typeof window !== 'undefined') installZipApiFetch();
  return children;
}
