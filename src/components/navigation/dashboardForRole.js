import React from 'react';

export function dashboardForRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'manufacturer') return 'manufacturer';
  return 'customerHome';
}
