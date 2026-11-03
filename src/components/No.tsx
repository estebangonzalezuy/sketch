import { pad } from '../lib/data';

/** Visual "Nº 042" with a raised, underlined ordinal (Geist's º sits on the baseline). */
export const No = ({ n }: { n: number }) => (
  <>
    N<span className="ord">o</span>
    {'\u2009'}
    {pad(n)}
  </>
);
