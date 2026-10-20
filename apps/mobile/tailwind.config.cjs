module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // NOTE: Цвета и размеры из packages/design/src/tokens.ts — одна дизайн-система
      // для классов NativeWind и анимированных стилей Reanimated.
      colors: {
        cream: '#FBF8EF',
        sage: { DEFAULT: '#2D6249', soft: '#A9C7A3', mist: '#E8EEDC' },
        peach: '#F3A16A',
      },
      borderRadius: { card: '22px', chip: '14px' },
      minHeight: { touch: '48px', row: '64px' },
      maxWidth: { screen: '520px' },
    },
  },
  plugins: [],
};
