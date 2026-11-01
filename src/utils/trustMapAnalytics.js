const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(['new', 'under_review', 'evidence_requested', 'manufacturer_contacted', 'investigating']);

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isOpenReport(report = {}) {
  return OPEN_STATUSES.has(report.status || 'new');
}

export function filterTrustReports(reports = [], statusFilter = 'all', timeFilter = 'all', now = Date.now()) {
  const windowDays = timeFilter === '30d' ? 30 : timeFilter === '90d' ? 90 : null;
  const cutoff = windowDays ? now - (windowDays * DAY_MS) : 0;

  return reports.filter((report) => {
    if (windowDays) {
      const created = timestampMs(report.createdAt);
      if (!created || created < cutoff) return false;
    }
    if (statusFilter === 'open') return isOpenReport(report);
    if (statusFilter === 'confirmed') return report.status === 'confirmed_issue';
    if (statusFilter === 'authentic') return report.status === 'closed_authentic';
    return true;
  });
}

function dominantText(rows, key, fallback = '') {
  const counts = new Map();
  rows.forEach((row) => {
    const value = String(row?.[key] || '').trim();
    if (!value || /not supplied|unknown/i.test(value)) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  let best = fallback;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

export function clusterTrustReports(reports = [], radiusKm = 8) {
  const groups = [];

  reports.forEach((report) => {
    if (!Number.isFinite(report.latitude) || !Number.isFinite(report.longitude)) return;
    let group = groups.find((candidate) => distanceKm(
      { latitude: candidate.latitude, longitude: candidate.longitude },
      { latitude: report.latitude, longitude: report.longitude },
    ) <= radiusKm);

    if (!group) {
      group = { rows: [], latitude: report.latitude, longitude: report.longitude };
      groups.push(group);
    }

    group.rows.push(report);
    group.latitude = group.rows.reduce((sum, row) => sum + row.latitude, 0) / group.rows.length;
    group.longitude = group.rows.reduce((sum, row) => sum + row.longitude, 0) / group.rows.length;
  });

  return groups.map((group, index) => {
    const rows = group.rows;
    const confirmed = rows.filter((row) => row.status === 'confirmed_issue').length;
    const authentic = rows.filter((row) => row.status === 'closed_authentic').length;
    const open = rows.filter(isOpenReport).length;
    const area = dominantText(rows, 'area', 'Privacy-protected area');
    const productName = dominantText(rows, 'productName', rows[0]?.productName || 'Product reports');
    const signal = confirmed > 0
      ? (rows.length > 1 ? 'Confirmed issue hotspot' : 'Confirmed issue')
      : rows.length >= 3
        ? 'High report activity'
        : rows.length >= 2
          ? 'Report cluster'
          : authentic > 0
            ? 'Closed authentic'
            : 'Open report';

    return {
      id: `cluster-${index}-${group.latitude.toFixed(3)}-${group.longitude.toFixed(3)}`,
      reports: rows,
      latitude: group.latitude,
      longitude: group.longitude,
      count: rows.length,
      confirmed,
      authentic,
      open,
      area,
      productName,
      signal,
      isHotspot: rows.length >= 2,
    };
  }).sort((a, b) => {
    const aScore = (a.confirmed * 4) + (a.open * 2) + a.count;
    const bScore = (b.confirmed * 4) + (b.open * 2) + b.count;
    return bScore - aScore;
  });
}

export function distanceKm(a, b) {
  if (!a || !b || !Number.isFinite(a.latitude) || !Number.isFinite(a.longitude) || !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function buildTrustMapSummary(reports = [], userLocation = null) {
  const valid = reports.filter((report) => Number.isFinite(report.latitude) && Number.isFinite(report.longitude));
  const clusters = clusterTrustReports(valid);
  const confirmed = reports.filter((report) => report.status === 'confirmed_issue').length;
  const authentic = reports.filter((report) => report.status === 'closed_authentic').length;
  const open = reports.filter(isOpenReport).length;
  const hotspots = clusters.filter((cluster) => cluster.isHotspot).length;
  const topArea = dominantText(reports, 'area', 'No area trend yet');
  const topProduct = dominantText(reports, 'productName', 'No product trend yet');
  const confirmedRate = reports.length ? Math.round((confirmed / reports.length) * 100) : 0;

  let nearest = null;
  let nearby = [];
  if (userLocation) {
    nearby = valid
      .map((report) => ({ ...report, distanceKm: distanceKm(userLocation, report) }))
      .filter((report) => Number.isFinite(report.distanceKm) && report.distanceKm <= 25)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    nearest = nearby[0] || null;
  }

  return {
    total: reports.length,
    confirmed,
    authentic,
    open,
    hotspots,
    clusters,
    topArea,
    topProduct,
    confirmedRate,
    nearbyCount: nearby.length,
    nearbyConfirmed: nearby.filter((report) => report.status === 'confirmed_issue').length,
    nearest,
  };
}

export function trustMapInsight(role, summary, userLocation) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (role === 'admin') {
    if (!summary.total) return 'No customer reports match these filters yet.';
    return `${plural(summary.total, 'report')}, ${summary.confirmed} confirmed (${summary.confirmedRate}%). Busiest area: ${summary.topArea}.`;
  }

  if (role === 'manufacturer') {
    if (!summary.total) return 'No customer reports about your products match these filters.';
    return `${plural(summary.total, 'report')} about your products, ${summary.confirmed} confirmed. Most reported: ${summary.topProduct}.`;
  }

  if (!userLocation) {
    if (!summary.total) return 'Nobody has reported a product on the map yet.';
    return `Most reports so far: ${summary.topArea}. Tap "Near me" to see reports close to you.`;
  }
  if (!summary.nearbyCount) return 'No product reports within 25 km of you. That is good news.';
  const distance = summary.nearest?.distanceKm != null ? `${summary.nearest.distanceKm.toFixed(1)} km` : 'close by';
  if (summary.nearbyConfirmed) return `${plural(summary.nearbyConfirmed, 'confirmed report')} within 25 km of you. The closest is ${distance} away.`;
  return `${plural(summary.nearbyCount, 'report')} within 25 km of you, none confirmed yet. The closest is ${distance} away.`;
}

// Plain-language status for a group of reports on the map.
export function clusterStatusKey(cluster = {}) {
  if (cluster.confirmed > 0) return 'confirmed';
  if (cluster.open > 0) return 'open';
  return 'authentic';
}

export function latestReportOf(cluster = {}) {
  const rows = Array.isArray(cluster.reports) ? [...cluster.reports] : [];
  rows.sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
  return rows[0] || null;
}

export function reportTimeMs(report = {}) {
  return timestampMs(report.createdAt);
}
