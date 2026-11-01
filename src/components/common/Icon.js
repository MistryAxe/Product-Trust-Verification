import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';

export function Icon({ name, size = 22, color = C.text }) {
  return <Ionicons name={name} size={size} color={color} />;
}
