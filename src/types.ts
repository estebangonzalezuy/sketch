export type Source = 'notion' | 'som';

export type Studio = {
  /** 1-based, after sorting by name (case-insensitive) */
  id: number;
  /** kebab-case of name, made unique with a -2 / -3 suffix */
  slug: string;
  name: string;
  cities: string[];
  countries: string[];
  /** normalized to https:// when the scheme is missing; original kept if unparseable */
  website: string | null;
  /** e.g. "buck.co", for display */
  domain: string | null;
  specialties: string[];
  sources: Source[];
  /** only from the optional data/studios_extended.csv */
  instagram: string | null;
};

export type FacetCount = { value: string; count: number };

export type Facets = {
  total: number;
  countries: FacetCount[];
  cities: FacetCount[];
  specialties: FacetCount[];
  sources: FacetCount[];
  /** city -> country, derived only from rows where the pairing is unambiguous; null if unknown */
  cityCountry: Record<string, string | null>;
};
