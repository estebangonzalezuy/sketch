const P: Record<string, React.ReactNode> = {
  sphere: <circle cx="8" cy="8" r="5.5" />,
  torus: <><ellipse cx="8" cy="8" rx="6" ry="4" /><ellipse cx="8" cy="7.4" rx="2.2" ry="1" /></>,
  capsule: <rect x="5" y="2" width="6" height="12" rx="3" />,
  blob: <path d="M5 3.5c2.5-2 6.5-.5 7 2.5.4 2.2 1.3 3 .2 5-1.200 2.200-4.500 2.800-6.700 1.500C3.300 11.200 2.500 9 3 7c.3-1.300.8-2.500 2-3.500z" />,
  text: <path d="M3.500 4V3h9v1M8 3v10M6.500 13h3" />,
  dish: <><ellipse cx="8" cy="6" rx="6" ry="2.500" /><path d="M2 6v3.500C2 10.900 4.700 12 8 12s6-1.100 6-2.500V6" /></>,
  box: <><path d="M8 2 13.500 5v6L8 14 2.500 11V5z" /><path d="M2.500 5 8 8l5.500-3M8 8v6" /></>,
  area: <><rect x="3" y="3" width="10" height="7" rx="1" /><path d="M5 12.500v1M8 12.500v1M11 12.500v1" /></>,
  spot: <><path d="M6 2h4l1 4H5z" /><path d="M4 13.500 6 9M12 13.500 10 9M8 9.500v4" /></>,
  hdri: <><circle cx="8" cy="8" r="5.500" /><path d="M2.500 8h11M8 2.500c2 1.500 2 9.500 0 11M8 2.500c-2 1.500-2 9.500 0 11" /></>,
  backdrop: <path d="M2.500 3v7c0 1.700 1.300 3 3 3h8" />,
  camera: <><rect x="2" y="4.500" width="9" height="7" rx="1.500" /><path d="m11 7 3-1.500v5L11 9" /></>,
  frame: <path d="M2.500 6V3.500a1 1 0 0 1 1-1H6M10 2.500h2.500a1 1 0 0 1 1 1V6M13.500 10v2.500a1 1 0 0 1-1 1H10M6 13.500H3.500a1 1 0 0 1-1-1V10" />,
  plus: <path d="M8 3.500v9M3.500 8h9" />,
  copy: <><rect x="5.500" y="5.500" width="8" height="8" rx="1.500" /><path d="M10.500 3.500v-.500a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.500" /></>,
  trash: <path d="M3 4.500h10M6.500 4.500v-2h3v2M4.500 4.500l.500 9h6l.500-9" />,
  eye: <><path d="M1.500 8S4 3.500 8 3.500 14.500 8 14.500 8 12 12.500 8 12.500 1.500 8 1.500 8z" /><circle cx="8" cy="8" r="2" /></>,
  eyeoff: <path d="M2.500 2.500l11 11M6.500 4c.500-.300 1-.500 1.500-.500 4 0 6.500 4.500 6.500 4.500s-.700 1.300-2 2.500M4 5.500C2.500 6.700 1.500 8 1.500 8S4 12.500 8 12.500c.700 0 1.400-.100 2-.400" />,
  play: <path d="M5 3.500v9l7.500-4.500z" fill="currentColor" />,
  pause: <path d="M5 3.500v9M11 3.500v9" strokeWidth="2.200" />,
  undo: <path d="M5.500 3 2.500 6l3 3M2.500 6h7a4 4 0 0 1 0 8H6" />,
  redo: <path d="m10.500 3 3 3-3 3M13.500 6h-7a4 4 0 0 0 0 8H10" />,
  search: <><circle cx="7" cy="7" r="4" /><path d="m10 10 3.500 3.500" /></>,
  dice: <><rect x="2.500" y="2.500" width="11" height="11" rx="2.500" /><circle cx="5.800" cy="5.800" r=".600" fill="currentColor" /><circle cx="10.200" cy="10.200" r=".600" fill="currentColor" /><circle cx="8" cy="8" r=".600" fill="currentColor" /></>,
  key: <path d="M8 3 13 8 8 13 3 8z" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
}
export function Icon({ name }: { name: string }) {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.300" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[name]}
    </svg>
  )
}
