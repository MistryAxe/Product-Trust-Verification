import React, { useEffect, useState } from 'react';
import { Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from '../common';

// The ONE bottom navigation bar for the whole app. Every screen and every role uses this same component, so it
// looks and behaves identically everywhere: same height, same place, same items for the same role.
export const NAV_ITEMS = {
  customer: [
    ['customerHome', 'home-outline', 'Home'],
    ['trustMap', 'map-outline', 'Map'],
    ['scan', 'scan-outline', 'Scan'],
    ['saved', 'heart-outline', 'Saved'],
    ['profile', 'person-outline', 'Profile'],
  ],
  manufacturer: [
    ['manufacturer', 'grid-outline', 'Dashboard'],
    ['manufacturerProducts', 'cube-outline', 'Products'],
    ['manufacturerAddProduct', 'add-circle-outline', 'Add'],
    ['investigations', 'search-circle-outline', 'Cases'],
    ['profile', 'person-outline', 'Profile'],
  ],
  admin: [
    ['admin', 'grid-outline', 'Dashboard'],
    ['investigations', 'search-circle-outline', 'Cases'],
    ['adminUsers', 'people-outline', 'Users'],
    ['trustMap', 'map-outline', 'Map'],
    ['profile', 'person-outline', 'Profile'],
  ],
};

export function navItemsFor(role) {
  return role === 'admin' ? NAV_ITEMS.admin : role === 'manufacturer' ? NAV_ITEMS.manufacturer : NAV_ITEMS.customer;
}

export function PortalNav({ role = 'customer', screen, go }) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // While the keyboard is open the bar steps aside, so it never rides up on top of the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardOpen) return null;

  const items = navItemsFor(role);
  // Some screens just say "home": that means this role's first item.
  const activeKey = screen === 'home' ? items[0][0] : screen;
  return (
    <View style={styles.bottomNav}>
      {items.map(([key, icon, label]) => {
        const active = activeKey === key;
        const primaryAction = (role === 'customer' && key === 'scan') || (role === 'manufacturer' && key === 'manufacturerAddProduct');
        return (
          <TouchableOpacity key={key} onPress={() => go(key)} style={styles.navItem}>
            <View style={primaryAction ? styles.scanFab : null}>
              <Icon name={icon} size={primaryAction ? 24 : 21} color={primaryAction ? C.dark : active ? C.primary : C.textFaint} />
            </View>
            {!primaryAction ? <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
