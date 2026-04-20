import { useEffect } from 'react';
import ReactDOM from 'react-dom';

const DEFAULTS = {
  title: 'ZEUS & AI · Unicorn Platform — Autonomous AI for Enterprise',
  description:
    'Deploy autonomous AI agents, manage enterprise operations, and scale revenue — all from one command center.',
  keywords: 'AI platform, autonomous agents, enterprise AI, SaaS, AI orchestration',
  ogImage: 'https://zeusai.app/og-image.png',
  canonicalPath: '/',
};

export default function SEOMeta({
  title = DEFAULTS.title,
  description = DEFAULTS.description,
  keywords = DEFAULTS.keywords,
  ogImage = DEFAULTS.ogImage,
  canonicalPath = DEFAULTS.canonicalPath,
}) {
  const fullTitle = title === DEFAULTS.title ? title : `${title} | ZEUS & AI`;
  const canonicalUrl = `https://zeusai.app${canonicalPath}`;

  useEffect(() => {
    document.title = fullTitle;
  }, [fullTitle]);

  const metaTags = (
    <>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </>
  );

  return ReactDOM.createPortal(metaTags, document.head);
}
