/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bg-color': '#fdfafa',
                'card-bg': '#EBE6DE',
                'text-primary': '#1a1a1a',
                'text-secondary': '#555555',
                'accent-color': '#2c3e50', // Keeping a dark accent for borders/buttons if needed generally

                // Semantic Status Colors (Preserved for logic but mapped to palette if needed, or kept distinct)
                'aqi-good': '#27ae60',
                'aqi-moderate': '#f1c40f',
                'aqi-poor': '#e67e22',
                'aqi-severe': '#c0392b',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                serif: ['"Playfair Display"', 'serif'],
            },
            boxShadow: {
                'card': '0 4px 6px rgba(0, 0, 0, 0.05)',
            }
        },
    },
    plugins: [],
}
