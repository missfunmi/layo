import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Láyo',
    short_name: 'Láyo',
    description: 'Fitness coaching assistant for female endurance athletes',
    start_url: '/',
    display: 'standalone',
    background_color: '#F1EFE8',
    theme_color: '#0F6E56',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
