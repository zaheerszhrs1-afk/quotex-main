'use client'

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  const current = Math.min(Math.max(1, page), totalPages)

  const pages = []
  const start = Math.max(1, current - 2)
  const end = Math.min(totalPages, current + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-qx-textMute">
        Page {current} of {totalPages}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={current === 1}
          className="rounded-md bg-qx-panel2 px-2.5 py-1.5 text-xs font-semibold text-qx-textDim hover:text-white disabled:opacity-40"
        >
          First
        </button>
        <button
          onClick={() => onPageChange(current - 1)}
          disabled={current === 1}
          className="rounded-md bg-qx-panel2 px-2.5 py-1.5 text-xs font-semibold text-qx-textDim hover:text-white disabled:opacity-40"
        >
          Prev
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              p === current
                ? 'bg-qx-green text-white'
                : 'bg-qx-panel2 text-qx-textDim hover:text-white'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(current + 1)}
          disabled={current === totalPages}
          className="rounded-md bg-qx-panel2 px-2.5 py-1.5 text-xs font-semibold text-qx-textDim hover:text-white disabled:opacity-40"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={current === totalPages}
          className="rounded-md bg-qx-panel2 px-2.5 py-1.5 text-xs font-semibold text-qx-textDim hover:text-white disabled:opacity-40"
        >
          Last
        </button>
      </div>
    </div>
  )
}
