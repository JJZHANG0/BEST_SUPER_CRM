'use client';
/** Competition / programme recognition marks under public/competition-logos/. */
import type { Program } from '@/lib/nexus/data';

const LOGO: Record<string, string> = {
  bpa: '/competition-logos/bpa.svg',
  conrad: '/competition-logos/conrad.svg',
  ctb: '/competition-logos/ctb.svg',
  ihosa: '/competition-logos/ihosa.svg',
  prime: '/competition-logos/prime.svg',
  mvp: '/competition-logos/mvp.svg',
  winter: '/competition-logos/winter.svg',
  summer: '/competition-logos/summer.svg',
};

export function competitionLogoSrc(programId: string) {
  return LOGO[programId] || null;
}

export function CompetitionLogo({ program, size = 28, className = '' }: { program: Pick<Program, 'id' | 'short' | 'name' | 'color'>; size?: number; className?: string }) {
  const src = competitionLogoSrc(program.id);
  if (src) {
    return <img src={src} alt="" width={size} height={size} className={'competition-logo ' + className} style={{ width: size, height: size }} loading="lazy" />;
  }
  return <span className={'competition-logo mono ' + (program.color || '') + ' ' + className} style={{ width: size, height: size, fontSize: Math.max(9, size * 0.32) }} aria-hidden="true">{program.short.slice(0, 4)}</span>;
}
