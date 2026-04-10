import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PredictiveNavigation() {
  const navigate = useNavigate();
  const [predictedPath, setPredictedPath] = useState('/');

  useEffect(() => {
    const predictNextPage = async () => {
      const predictions = { '/codex': 0.4, '/dashboard': 0.3, '/marketplace': 0.2 };
      const best = Object.entries(predictions).sort((a, b) => b[1] - a[1])[0];
      setPredictedPath(best[0]);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = best[0];
      document.head.appendChild(link);
    };

    predictNextPage();

    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === 'ArrowRight') {
        navigate(predictedPath);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate, predictedPath]);

  return null;
}
