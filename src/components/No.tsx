import { pad } from '../lib/data';

/** "Nº 042" with a raised ordinal; the serif's º is drawn small and high on purpose. */
export const No = ({ n }: { n: number }) => (
  <>
    N<span className="ord">o</span>
    {' '}
    {pad(n)}
  </>
);
