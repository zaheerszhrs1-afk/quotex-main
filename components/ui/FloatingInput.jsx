'use client'
import { useState } from 'react'

// Material-style outlined input with the label notched into the top border,
// matching the Quotex auth form.
export default function FloatingInput({
  label,
  type = 'text',
  value,
  onChange,
  icon = null,
  rightSlot = null,
  as = 'input',
  children,
  ...rest
}) {
  const [focused, setFocused] = useState(false)
  const filled = value != null && String(value).length > 0
  const floated = focused || filled || as === 'select'

  return (
    <div
      className="relative rounded-md border bg-transparent transition-colors"
      style={{ borderColor: focused ? '#8B95A7' : '#525D6F' }}
    >
      <label
        className={`pointer-events-none absolute left-3 px-1 bg-[#3E4859] transition-all duration-150 ${
          floated
            ? '-top-2 text-[11px] text-[#9AA4B5]'
            : 'top-1/2 -translate-y-1/2 text-[15px] text-[#9AA4B5]'
        }`}
        style={{ zIndex: 1 }}
      >
        {label}
      </label>
      <div className="flex items-center">
        {icon ? <span className="pl-3 text-[#8A93A6]">{icon}</span> : null}
        {as === 'select' ? (
          <select
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full appearance-none bg-transparent px-3 py-[18px] text-[15px] text-white outline-none"
            {...rest}
          >
            {children}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full bg-transparent px-3 py-[18px] text-[15px] text-white outline-none"
            {...rest}
          />
        )}
        {rightSlot}
        {as === 'select' && (
          <span className="pr-3 text-[#8A93A6]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </div>
    </div>
  )
}
