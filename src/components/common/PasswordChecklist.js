import React from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { passwordChecks } from '../../utils/validation';
import { Icon } from './Icon';

export function PasswordChecklist({ password, confirm }) {
  const checks = passwordChecks(password);
  const items = [
    ['length', 'At least 8 characters'],
    ['upper', 'One uppercase letter'],
    ['lower', 'One lowercase letter'],
    ['number', 'One number'],
    ['special', 'One special character'],
  ];
  return (
    <View style={styles.passwordChecklist}>
      {items.map(([key, label]) => (
        <View key={key} style={styles.passwordRule}>
          <Icon name={checks[key] ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={checks[key] ? C.primary : C.textFaint} />
          <Text style={[styles.passwordRuleText, checks[key] && { color: C.text }]}>{label}</Text>
        </View>
      ))}
      {confirm ? (
        <View style={styles.passwordRule}>
          <Icon name={password === confirm ? 'checkmark-circle' : 'close-circle-outline'} size={15} color={password === confirm ? C.primary : C.danger} />
          <Text style={[styles.passwordRuleText, { color: password === confirm ? C.text : C.danger }]}>Passwords match</Text>
        </View>
      ) : null}
    </View>
  );
}
