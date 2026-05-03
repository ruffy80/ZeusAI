import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

export const useScrollReveal = (threshold = 0.1) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: threshold });

  useEffect(() => {
    if (isInView && ref.current) {
      ref.current.style.opacity = '1';
      ref.current.style.transform = 'translateY(0)';
      ref.current.style.filter = 'blur(0)';
    }
  }, [isInView]);

  return ref;
};
