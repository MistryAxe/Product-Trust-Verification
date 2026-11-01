const darkPalette = {
  primary: '#C9F05A',
  primaryBg: '#1A2A12',
  deepGreen: '#023C0A',
  deepGreen2: '#052A0B',
  moss: '#71985E',
  softGreen: '#E0F59F',
  success: '#9DD93D',
  successBg: '#1A2A12',
  warning: '#E0B84E',
  warningBg: '#2C2715',
  danger: '#FF6B6B',
  dangerBg: '#351717',
  purple: '#C9F05A',
  purpleBg: '#1A2A12',
  cyan: '#A7C776',
  cyanBg: '#15251A',
  bg: '#050805',
  surface: '#0B100C',
  surface2: '#111A12',
  surface3: '#172319',
  text: '#F7FAF3',
  textSoft: '#A9B5A5',
  textFaint: '#6F7D6B',
  border: '#243126',
  dark: '#030503',
};

const lightPalette = {
  primary: '#A6D928',
  primaryBg: '#EEF7D5',
  deepGreen: '#0D5C1A',
  deepGreen2: '#E8F2E7',
  moss: '#557746',
  softGreen: '#D8EE99',
  success: '#4E8D20',
  successBg: '#EDF7E5',
  warning: '#8A6813',
  warningBg: '#FFF6D8',
  danger: '#C84444',
  dangerBg: '#FDEAEA',
  purple: '#5E7B22',
  purpleBg: '#EEF4DF',
  cyan: '#52726B',
  cyanBg: '#E7F1EE',
  bg: '#F7F9F4',
  surface: '#FFFFFF',
  surface2: '#FFFFFF',
  surface3: '#EEF3EB',
  text: '#11180F',
  textSoft: '#5D6859',
  textFaint: '#7E897A',
  border: '#D8E0D5',
  dark: '#030503',
};

export const C = { ...darkPalette };

export function applyColorScheme(scheme = 'dark') {
  Object.assign(C, scheme === 'light' ? lightPalette : darkPalette);
}

export function paletteFor(scheme = 'dark') {
  return scheme === 'light' ? lightPalette : darkPalette;
}
