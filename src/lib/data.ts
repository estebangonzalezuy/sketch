import studiosJson from '../data/studios.json';
import facetsJson from '../data/facets.json';
import type { Facets, Source, Studio } from '../types';

export const studios = studiosJson as Studio[];
export const facets = facetsJson as Facets;
export const bySlug = new Map(studios.map((s) => [s.slug, s]));

export const SOURCE_LABEL: Record<Source, string> = {
  notion: 'SK Robert list',
  som: 'School of Motion',
};

export const SOURCE_INFO: Record<Source, { title: string; by: string; url: string; host: string }> =
  {
    notion: {
      title: 'Motion Design Studios',
      by: 'compiled by SK Robert',
      url: 'https://skrowbear.com',
      host: 'skrowbear.com',
    },
    som: {
      title: '500 Studios You Need to Know',
      by: 'School of Motion',
      url: 'https://www.schoolofmotion.com/landing-page/500-studios',
      host: 'schoolofmotion.com/landing-page/500-studios',
    },
  };

export const pad = (n: number) => String(n).padStart(3, '0');
export const no = (n: number) => `Nº ${pad(n)}`;
