import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../../theme';

export function ChoiceChips({ value, options, onChange }) {
  return (
    <View style={styles.choiceChipRow}>
      {options.map((option) => {
        const key = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        const selected = value === key;
        return (
          <TouchableOpacity key={key} onPress={() => onChange(key)} style={[styles.choiceChip, selected && styles.choiceChipActive]}>
            <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
