import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';

export function PremiumSectionTitle({ eyebrow, title, action, onAction }) {
  return (
    <View style={styles.premiumSectionHead}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.premiumEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.premiumSectionTitle}>{title}</Text>
      </View>
      {action ? <TouchableOpacity onPress={onAction}><Text style={styles.linkSmall}>{action}</Text></TouchableOpacity> : null}
    </View>
  );
}
