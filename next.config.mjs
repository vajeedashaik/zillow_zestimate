/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile leaflet packages that use ES modules
  transpilePackages: ['leaflet', 'react-leaflet', 'leaflet.heat'],
};

export default nextConfig;
