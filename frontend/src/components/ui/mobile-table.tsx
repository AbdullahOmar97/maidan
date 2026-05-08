import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Generic column definition
// ---------------------------------------------------------------------------
export interface Column<T> {
  key: string;
  label: string;
  /** Render a value from the row; defaults to `String(row[key])` */
  render?: (row: T) => React.ReactNode;
  /** Extra class for the desktop <th> */
  thClass?: string;
  /** Extra class for the desktop <td> */
  tdClass?: string;
  /** If true, column is omitted on mobile card (still shown in table) */
  hideOnCard?: boolean;
}

// ---------------------------------------------------------------------------
// Mobile invoice card (used internally as default)
// ---------------------------------------------------------------------------
interface MobileCardProps<T> {
  row: T;
  columns: Column<T>[];
  actions?: (row: T) => React.ReactNode;
}

function DefaultMobileCard<T extends Record<string, any>>({
  row,
  columns,
  actions,
}: MobileCardProps<T>) {
  const visibleColumns = columns.filter((c) => !c.hideOnCard);
  const [primary, ...rest] = visibleColumns;

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Primary field */}
      {primary && (
        <div className="flex items-center justify-between gap-3">
          <div className="font-black text-sm text-white">
            {primary.render ? primary.render(row) : String(row[primary.key] ?? "")}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions(row)}</div>
          )}
        </div>
      )}
      {/* Rest */}
      <div className="grid grid-cols-2 gap-2">
        {rest.map((col) => (
          <div key={col.key}>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">
              {col.label}
            </p>
            <div className="text-xs font-bold text-white">
              {col.render ? col.render(row) : String(row[col.key] ?? "")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface MobileCardListProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  /** Custom card renderer. Falls back to DefaultMobileCard. */
  renderCard?: (row: T) => React.ReactNode;
  /** Row actions for the desktop table (rightmost column) */
  renderActions?: (row: T) => React.ReactNode;
  /** Key extractor */
  keyExtractor: (row: T) => string | number;
  /** Show skeleton rows */
  loading?: boolean;
  /** Number of skeleton rows */
  skeletonCount?: number;
  /** Empty state content */
  emptyState?: React.ReactNode;
  className?: string;
}

/**
 * Renders a responsive table:
 * - Desktop (md+): standard <table>
 * - Mobile: card list
 *
 * Usage:
 * ```tsx
 * <MobileCardList columns={cols} data={rows} keyExtractor={r => r.id} />
 * ```
 */
export function MobileCardList<T extends Record<string, any>>({
  columns,
  data,
  renderCard,
  renderActions,
  keyExtractor,
  loading = false,
  skeletonCount = 5,
  emptyState,
  className,
}: MobileCardListProps<T>) {
  if (loading) {
    return (
      <>
        {/* Desktop skeleton */}
        <div className={cn("table-desktop glass-card overflow-hidden", className)}>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground",
                        col.thClass
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                  {renderActions && <th className="py-5 px-6" />}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-white/5">
                    {columns.map((col) => (
                      <td key={col.key} className="py-6 px-6">
                        <div className="h-4 bg-white/5 rounded-lg w-full" />
                      </td>
                    ))}
                    {renderActions && (
                      <td className="py-6 px-6">
                        <div className="h-4 bg-white/5 rounded-lg w-16 ml-auto" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile skeleton */}
        <div className="table-mobile space-y-3">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="glass-card p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded-lg w-3/4" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-3 bg-white/5 rounded w-full" />
                <div className="h-3 bg-white/5 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (!loading && data.length === 0 && emptyState) {
    return (
      <div className={cn("glass-card overflow-hidden", className)}>
        {emptyState}
      </div>
    );
  }

  return (
    <>
      {/* ── Desktop Table ── */}
      <div className={cn("table-desktop glass-card overflow-hidden", className)}>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/5">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "py-5 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground",
                      col.thClass
                    )}
                  >
                    {col.label}
                  </th>
                ))}
                {renderActions && <th className="py-5 px-6" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="group hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("py-5 px-6", col.tdClass)}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                  {renderActions && (
                    <td className="py-5 px-6 text-left">
                      <div className="flex items-center gap-2 justify-end">
                        {renderActions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile Card List ── */}
      <div className="table-mobile space-y-3">
        {data.map((row) =>
          renderCard ? (
            <div key={keyExtractor(row)}>{renderCard(row)}</div>
          ) : (
            <DefaultMobileCard
              key={keyExtractor(row)}
              row={row}
              columns={columns}
              actions={renderActions}
            />
          )
        )}
      </div>
    </>
  );
}
