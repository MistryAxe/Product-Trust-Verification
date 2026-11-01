import React, { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';
import { Input } from './Input';

export const PasswordInput = React.forwardRef(function PasswordInput({ label, value, onChangeText, placeholder = 'Password', ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      rightAccessory={(
        <TouchableOpacity accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible((old) => !old)} style={styles.eyeButton}>
          <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={C.textSoft} />
        </TouchableOpacity>
      )}
      {...props}
    />
  );
});
