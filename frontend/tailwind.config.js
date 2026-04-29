/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#00f2ff",
                secondary: "#7000ff",
                accent: "#ff00c8",
            }
        },
    },
    plugins: [],
}
