import React from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';
import { SecondaryButton } from './SecondaryButton';

export function EmptyState({ icon = 'file-tray-outline', title, text, action, onAction }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Icon name={icon} size={34} color={C.textSoft} /></View>
      <Text style={styles.h3}>{title}</Text>
      {text ? <Text style={styles.bodyCenter}>{text}</Text> : null}
      {action ? <View style={{ width: '100%', marginTop: 12 }}><SecondaryButton title={action} onPress={onAction} /></View> : null}
    </View>
  );
}
