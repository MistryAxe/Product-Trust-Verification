import React from 'react';
import { PortalNav } from './PortalNav';

// Kept only so older imports keep working. It is the same bar as PortalNav (there is now a single implementation).
export function BottomNav({ screen, go, role = 'customer' }) {
  return <PortalNav role={role} screen={screen} go={go} />;
}
