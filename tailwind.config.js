module.exports = {
  mode: 'jit',
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      'sans': ['Product Sans'],
    }
  },
  variants: {
    extend: {
    },
    animation: ["motion-safe"],
  },
  plugins: [],
}
