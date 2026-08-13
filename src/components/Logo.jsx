import React from 'react'

const SRC = {
  light: '/logo-light.png',
  dark: '/logo-dark.png',
}

/**
 * Brand mark. `light` = dark word + lime ball (cream pages).
 * `dark` = white word (pine header / admin). `animate` bounces the pickleball.
 */
export default function Logo({
  variant = 'light',
  animate = false,
  size = 'md',
  alt = 'Bounce Pickleball House',
}) {
  return (
    <div
      className={`brand-logo brand-${variant} brand-${size}${animate ? ' is-bounce' : ''}`}
      role="img"
      aria-label={alt}
    >
      <img src={SRC[variant] || SRC.light} alt="" draggable="false" />
      {animate && (
        <>
          <span className="brand-ball-mask" aria-hidden="true" />
          <span className="brand-ball" aria-hidden="true" />
          <span className="brand-ball-shadow" aria-hidden="true" />
        </>
      )}
    </div>
  )
}
