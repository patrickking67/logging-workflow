/** @type {import('tailwindcss').Config} */
// Colors are CSS variables set in src/index.css, so light and dark mode
// follow the system setting without dark: variants.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				paper: token("paper"),
				surface: token("surface"),
				ink: token("ink"),
				muted: token("muted"),
				rule: token("rule"),
				run: token("run"),
				wait: token("wait"),
				done: token("done"),
				fail: token("fail"),
			},
		},
	},
	plugins: [],
};
