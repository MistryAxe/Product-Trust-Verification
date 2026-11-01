import React from 'react';
import { Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon } from './Icon';
import { PrimaryButton } from './PrimaryButton';

// A crash in one screen must never leave the person on a blank or red screen with no way out.
// This catches it, says something kind, and "Try again" rebuilds the app (they stay signed in).
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, attempt: 0 };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Kept for the developer console; nothing personal is shown to the user.
    console.error('[ErrorBoundary]', error?.message || error, info?.componentStack || '');
  }

  retry = () => this.setState((old) => ({ failed: false, attempt: old.attempt + 1 }));

  render() {
    if (this.state.failed) {
      return (
        <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
          <Icon name="alert-circle-outline" size={44} color={C.danger} />
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.text, textAlign: 'center' }}>Something went wrong</Text>
          <Text style={[styles.bodySoft, { textAlign: 'center', fontSize: 14, lineHeight: 21 }]}>
            Product Trust ran into a problem. Your account and saved data are safe. Tap below to start again.
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <PrimaryButton title="Try again" icon="refresh-outline" onPress={this.retry} />
          </View>
        </View>
      );
    }
    // The key makes "Try again" rebuild everything below from scratch.
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
