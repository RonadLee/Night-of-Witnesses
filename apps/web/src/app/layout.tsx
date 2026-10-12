import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Night of Witnesses',
  description: 'A social deduction game of sightings, silence, and the Boiler Room.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('now-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
