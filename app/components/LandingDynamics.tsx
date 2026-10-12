'use client';

import dynamic from 'next/dynamic';

const StackedScroll = dynamic(() => import('@/components/animations/StackedScroll'), { ssr: false });
const ScratchFooter = dynamic(() => import('@/components/canvas/ScratchFooter'), { ssr: false });

export { StackedScroll, ScratchFooter };
