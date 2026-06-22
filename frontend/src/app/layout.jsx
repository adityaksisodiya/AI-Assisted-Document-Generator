import './globals.css';

export const metadata = {
  title: 'DocGen Platform',
  description: 'Enterprise Document Generation',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}