import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { C, styles } from '../../theme';

export const Input = React.forwardRef(function Input({ label, multiline = false, rightAccessory = null, inputStyle, ...props }, ref) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.inputShell, multiline && styles.inputShellMultiline]}>
        <TextInput
          ref={ref}
          placeholderTextColor={C.textFaint}
          multiline={multiline}
          style={[styles.input, styles.inputInsideShell, multiline && styles.inputMultiline, inputStyle]}
          autoCapitalize="none"
          {...props}
        />
        {rightAccessory ? <View style={styles.inputAccessory}>{rightAccessory}</View> : null}
      </View>
    </View>
  );
});
