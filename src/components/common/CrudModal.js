import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';
import { Icon } from './Icon';

export function CrudModal({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.crudModalBackdrop}>
        <View style={styles.crudModalCard}>
          <View style={styles.crudModalHeader}>
            <Text style={styles.crudModalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.smallIconButton}><Icon name="close" size={20} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.crudModalBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
