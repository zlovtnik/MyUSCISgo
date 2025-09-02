/**
 * Animation utilities for enhanced user experience
 */

// Easing functions for smooth animations
export const easing = {
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
};

// Animation durations
export const duration = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  slower: '750ms'
};

// Common animation classes
export const animations = {
  fadeIn: 'animate-in fade-in duration-300',
  fadeOut: 'animate-out fade-out duration-300',
  slideInFromTop: 'animate-in slide-in-from-top-2 duration-300',
  slideInFromBottom: 'animate-in slide-in-from-bottom-2 duration-300',
  slideInFromLeft: 'animate-in slide-in-from-left-2 duration-300',
  slideInFromRight: 'animate-in slide-in-from-right-2 duration-300',
  scaleIn: 'animate-in zoom-in-95 duration-300',
  scaleOut: 'animate-out zoom-out-95 duration-300',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
  spin: 'animate-spin'
};

// Stagger animation delays for lists
export const staggerDelays = [
  'delay-0',
  'delay-75',
  'delay-150',
  'delay-300',
  'delay-500',
  'delay-700',
  'delay-1000'
];

/**
 * Get stagger delay class for list items
 */
export const getStaggerDelay = (index: number): string => {
  return staggerDelays[Math.min(index, staggerDelays.length - 1)];
};

/**
 * Create a smooth transition style object
 */
export const createTransition = (
  properties: string[] = ['all'],
  duration: string = '300ms',
  easing: string = 'cubic-bezier(0.4, 0, 0.2, 1)'
): React.CSSProperties => ({
  transition: properties.map(prop => `${prop} ${duration} ${easing}`).join(', ')
});

/**
 * Animation presets for common UI patterns
 */
export const presets = {
  button: {
    hover: 'transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-md',
    press: 'active:scale-95 active:transition-none'
  },
  card: {
    hover: 'transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-1',
    focus: 'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2'
  },
  modal: {
    backdrop: 'animate-in fade-in duration-300',
    content: 'animate-in fade-in zoom-in-95 duration-300'
  },
  toast: {
    enter: 'animate-in slide-in-from-top-2 fade-in duration-300',
    exit: 'animate-out slide-out-to-top-2 fade-out duration-200'
  },
  tab: {
    active: 'transition-all duration-200 ease-in-out',
    inactive: 'transition-all duration-200 ease-in-out opacity-70 hover:opacity-100'
  },
  loading: {
    skeleton: 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]',
    spinner: 'animate-spin',
    dots: 'animate-bounce'
  }
};

/**
 * Performance-optimized animation utilities
 */
export const performance = {
  // Use transform and opacity for better performance
  optimizedTransition: 'transition-transform transition-opacity duration-300 ease-in-out',
  
  // GPU acceleration
  gpuAccelerated: 'transform-gpu',
  
  // Reduce motion for accessibility
  respectMotionPreference: 'motion-reduce:transition-none motion-reduce:animate-none'
};

/**
 * Create keyframe animations
 */
export const keyframes = {
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `,
  
  slideInUp: `
    @keyframes slideInUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,
  
  fadeInScale: `
    @keyframes fadeInScale {
      from {
        transform: scale(0.95);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `,
  
  progressBar: `
    @keyframes progressBar {
      0% { width: 0%; }
      100% { width: var(--progress-width, 100%); }
    }
  `
};

/**
 * Animation hook for React components
 */
export const useAnimation = (
  trigger: boolean,
  enterClass: string = animations.fadeIn,
  exitClass: string = animations.fadeOut
) => {
  return trigger ? enterClass : exitClass;
};

/**
 * Intersection Observer animation trigger
 */
export const createIntersectionAnimation = (
  element: Element,
  animationClass: string,
  options: IntersectionObserverInit = { threshold: 0.1 }
) => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add(...animationClass.split(' '));
        observer.unobserve(entry.target);
      }
    });
  }, options);

  observer.observe(element);
  
  return () => observer.disconnect();
};

export default {
  easing,
  duration,
  animations,
  staggerDelays,
  getStaggerDelay,
  createTransition,
  presets,
  performance,
  keyframes,
  useAnimation,
  createIntersectionAnimation
};