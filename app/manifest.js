export default function manifest() {
  return {
    name: "Diário Olfativo",
    short_name: "Olfativo",
    description: "Coleção pessoal de perfumes com busca automática de dados e suas próprias impressões.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf3ec",
    theme_color: "#9c3b53",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
