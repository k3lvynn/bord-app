import { StyleSheet } from 'react-native';

export const colors = {
  black:    '#080808',
  panel:    '#141414',
  card:     '#1E1E1E',
  border:   '#2C2C2C',
  orange:   '#F97316',
  rose:     '#F43F5E',
  white:    '#FFFFFF',
  gray1:    '#A8A29E',
  gray2:    '#5C5654',
  gray3:    '#2E2E2E',
  green:    '#34D399',
  lavender: '#9B8EC4',
  red:      '#EF4444',
};

export const fonts = {
  // Using system fonts for native — clean and readable
  display: 'System',
  body:    'System',
};

export const radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  full: 999,
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.gray2,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.white,
    fontSize: 15,
    fontWeight: '500',
  },
  inputFocused: {
    borderColor: 'rgba(249,115,22,0.5)',
  },
  btn: {
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.orange,
  },
  btnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  meta: {
    fontSize: 13,
    color: colors.gray1,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
});
