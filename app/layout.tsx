import "./globals.css";

export const metadata = {
  title: "CorporateBuddy Dashboard",
  description: "Enterprise Intelligence Suite",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
