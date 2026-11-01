import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';

export function CrudRowActions({ onEdit, onDelete, deleteLabel = 'Delete' }) {
  return (
    <View style={styles.crudRowActions}>
      {onEdit ? <TouchableOpacity onPress={onEdit} style={styles.crudIconButton}><Icon name="create-outline" size={18} color={C.primary} /></TouchableOpacity> : null}
      {onDelete ? <TouchableOpacity onPress={onDelete} style={[styles.crudIconButton, { borderColor: C.danger }]}><Icon name="trash-outline" size={18} color={C.danger} /></TouchableOpacity> : null}
    </View>
  );
}
