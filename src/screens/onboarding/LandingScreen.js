import React from 'react';
import { ImageBackground, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen } from '../../components/common';

export default function LandingScreen({ onSignIn, onCreateAccount }) {
  return (
    <Screen style={{ backgroundColor: C.dark }}>
      <View style={styles.onboardingShell}>
        <ImageBackground
          source={require('../../../assets/home-community.jpeg')}
          style={styles.onboardingImage}
          imageStyle={styles.onboardingImageStyle}
        >
          <View style={styles.onboardingShade} />
          <View style={styles.onboardingBrandRow}>
            <View style={styles.onboardingBrandIcon}><Icon name="shield-checkmark" size={20} color={C.dark} /></View>
            <Text style={styles.onboardingBrandText}>Product Trust</Text>
          </View>
          <View style={styles.onboardingImageTag}>
            <Icon name="scan-outline" size={14} color={C.dark} />
            <Text style={styles.onboardingImageTagText}>SCAN • CHECK • TRUST</Text>
          </View>
        </ImageBackground>

        <View style={styles.onboardingPanel}>
          <View style={styles.onboardingDots}>
            <View style={[styles.onboardingDot, styles.onboardingDotActive]} />
            <View style={styles.onboardingDot} />
            <View style={styles.onboardingDot} />
          </View>
          <Text style={styles.onboardingTitle}>Know what you are buying.</Text>
          <Text style={styles.onboardingCopy}>Verify registered products, compare trusted records and report suspicious items before you buy or use them.</Text>

          <View style={styles.onboardingButtons}>
            <TouchableOpacity style={styles.onboardingSignIn} activeOpacity={0.86} onPress={onSignIn}>
              <Text style={styles.onboardingSignInText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.onboardingJoin} activeOpacity={0.86} onPress={onCreateAccount}>
              <Text style={styles.onboardingJoinText}>Join</Text>
              <Icon name="arrow-forward" size={17} color={C.dark} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Screen>
  );
}
