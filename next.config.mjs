/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Add Azure CDN or other image hosting domains as needed
      // {
      //   protocol: "https",
      //   hostname: "your-azure-cdn.azureedge.net",
      // },
    ],
  },
};

export default nextConfig;
