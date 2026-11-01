import { useEffect, useMemo, useState } from 'react';
import { subscribePublicReports } from '../services/reportService';
import { friendlyFirebaseError } from '../utils/firebaseErrors';
import { buildTrustMapSummary, filterTrustReports } from '../utils/trustMapAnalytics';

// One place for the Safety Map's data, so the phone and web versions behave the
// same: load the public reports, apply the role rule and the filters, group
// nearby reports into pins.
export function useTrustMapData(profile, userLocation) {
  const role = profile?.role === 'consumer' ? 'customer' : (profile?.role || 'customer');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    return subscribePublicReports(
      profile,
      (rows) => { setReports(rows); setError(''); setLoading(false); },
      (e) => { setError(friendlyFirebaseError(e)); setLoading(false); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, profile?.uid]);

  const visibleReports = useMemo(() => {
    if (role === 'manufacturer') return reports.filter((report) => report.manufacturerId && report.manufacturerId === profile?.uid);
    return reports;
  }, [reports, role, profile?.uid]);

  const productOptions = useMemo(() => {
    const counts = new Map();
    visibleReports.forEach((report) => {
      const name = String(report.productName || '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name]) => [name, name]);
    return [['all', 'All products'], ...top];
  }, [visibleReports]);

  const filteredReports = useMemo(() => {
    const byProduct = productFilter === 'all' ? visibleReports : visibleReports.filter((report) => report.productName === productFilter);
    return filterTrustReports(byProduct, statusFilter, timeFilter);
  }, [visibleReports, productFilter, statusFilter, timeFilter]);

  const summary = useMemo(() => buildTrustMapSummary(filteredReports, userLocation), [filteredReports, userLocation]);

  return {
    role, loading, error, summary,
    statusFilter, setStatusFilter, timeFilter, setTimeFilter, productFilter, setProductFilter, productOptions,
    totalBeforeFilters: visibleReports.length,
  };
}
