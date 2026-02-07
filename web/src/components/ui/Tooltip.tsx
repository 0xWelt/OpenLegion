import { useState, useRef, useEffect, type ReactNode } from 'react'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}

export default function Tooltip({
  children,
  content,
  placement = 'bottom',
  delay = 0,
  className = ''
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [adjustedPlacement, setAdjustedPlacement] = useState(placement)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Calculate best placement and position
  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const trigger = triggerRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    const padding = 8 // minimum padding from viewport edges

    // Calculate available space in each direction
    const space = {
      top: trigger.top - padding,
      bottom: viewport.height - trigger.bottom - padding,
      left: trigger.left - padding,
      right: viewport.width - trigger.right - padding
    }

    // Determine best placement based on available space
    let bestPlacement = placement
    let fits = false

    // Check if preferred placement fits
    switch (placement) {
      case 'bottom':
        fits = space.bottom >= tooltip.height
        break
      case 'top':
        fits = space.top >= tooltip.height
        break
      case 'left':
        fits = space.left >= tooltip.width
        break
      case 'right':
        fits = space.right >= tooltip.width
        break
    }

    // If preferred placement doesn't fit, find one that does
    if (!fits) {
      const verticalSpace = Math.max(space.top, space.bottom)
      const horizontalSpace = Math.max(space.left, space.right)

      if (verticalSpace >= horizontalSpace) {
        // Use vertical placement
        bestPlacement = space.bottom >= space.top ? 'bottom' : 'top'
      } else {
        // Use horizontal placement
        bestPlacement = space.right >= space.left ? 'right' : 'left'
      }
    }

    setAdjustedPlacement(bestPlacement)

    // Calculate position to ensure tooltip stays within viewport
    let x = 0
    let y = 0

    switch (bestPlacement) {
      case 'bottom':
      case 'top': {
        // Center horizontally, but adjust if it would overflow
        const centerX = trigger.left + trigger.width / 2
        let left = centerX - tooltip.width / 2
        let right = left + tooltip.width

        // Adjust if overflows left
        if (left < padding) {
          left = padding
          right = left + tooltip.width
        }
        // Adjust if overflows right
        if (right > viewport.width - padding) {
          right = viewport.width - padding
          left = right - tooltip.width
        }

        x = left - trigger.left
        y = bestPlacement === 'bottom'
          ? trigger.height + 8 // mt-2 = 8px
          : -tooltip.height - 8 // mb-2 = 8px
        break
      }
      case 'left':
      case 'right': {
        // Center vertically, but adjust if it would overflow
        const centerY = trigger.top + trigger.height / 2
        let top = centerY - tooltip.height / 2
        let bottom = top + tooltip.height

        // Adjust if overflows top
        if (top < padding) {
          top = padding
          bottom = top + tooltip.height
        }
        // Adjust if overflows bottom
        if (bottom > viewport.height - padding) {
          bottom = viewport.height - padding
          top = bottom - tooltip.height
        }

        x = bestPlacement === 'right'
          ? trigger.width + 8 // ml-2 = 8px
          : -tooltip.width - 8 // mr-2 = 8px
        y = top - trigger.top
        break
      }
    }

    setPosition({ x, y })
  }

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsMounted(true)
      // Calculate position after mount
      requestAnimationFrame(() => {
        calculatePosition()
        setIsVisible(true)
      })
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
    timeoutRef.current = setTimeout(() => {
      setIsMounted(false)
      setAdjustedPlacement(placement)
      setPosition({ x: 0, y: 0 })
    }, 150)
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-oc-border border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-oc-border border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-oc-border border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-oc-border border-t-transparent border-b-transparent border-l-transparent'
  }

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isMounted && (
        <div
          ref={tooltipRef}
          className="absolute z-50 transition-all duration-150 pointer-events-none"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: `translate(${position.x}px, ${position.y}px) scale(${isVisible ? 1 : 0.95})`,
            left: adjustedPlacement === 'left' ? 0 : adjustedPlacement === 'right' ? '100%' : '50%',
            top: adjustedPlacement === 'top' ? 0 : adjustedPlacement === 'bottom' ? '100%' : '50%',
            marginLeft: adjustedPlacement === 'top' || adjustedPlacement === 'bottom' ? '-50%' : 0,
            marginTop: adjustedPlacement === 'left' || adjustedPlacement === 'right' ? '-50%' : 0,
          }}
        >
          <div className="relative">
            {/* Arrow - only show when centered */}
            {(adjustedPlacement === 'top' || adjustedPlacement === 'bottom') && position.x === 0 && (
              <div
                className={`absolute w-0 h-0 border-4 ${arrowClasses[adjustedPlacement]}`}
              />
            )}
            {(adjustedPlacement === 'left' || adjustedPlacement === 'right') && position.y === 0 && (
              <div
                className={`absolute w-0 h-0 border-4 ${arrowClasses[adjustedPlacement]}`}
              />
            )}
            {/* Content - compact style matching context popover */}
            <div className="bg-oc-surface text-oc-text px-2 py-1.5 rounded-md border border-oc-border shadow-lg text-sm whitespace-nowrap">
              {content}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
