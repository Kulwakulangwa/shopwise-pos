{l.tracksSerial && (
  <div className="mt-2 flex flex-wrap items-center gap-1.5">
    {((serials.data ?? []) as any[])
      .filter((s) => s.product_id === l.productId && (!warehouseId || s.warehouse_id === warehouseId))
      .map((s) => {
        const picked = l.serials.includes(s.serial);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() =>
              setLines((cur) =>
                cur.map((x) =>
                  x.productId === l.productId
                    ? {
                        ...x,
                        serials: picked
                          ? x.serials.filter((v) => v !== s.serial)
                          : [...x.serials, s.serial],
                      }
                    : x,
                ),
              )
            }
            className={`rounded-md border px-2 py-1 text-xs ${picked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {s.serial}
          </button>
        );
      })}
    <span className="self-center text-xs text-muted-foreground">
      {l.serials.length}/{l.qty} selected
    </span>
    {/* 👇 NEW: message when no serials are available */}
    {((serials.data ?? []) as any[])
      .filter((s) => s.product_id === l.productId && (!warehouseId || s.warehouse_id === warehouseId))
      .length === 0 && (
      <div className="w-full text-xs text-muted-foreground">
        ⚠️ No serial numbers available for this product in the selected warehouse.
        <button
          type="button"
          className="ml-1 text-primary underline"
          onClick={() => window.location.href = '/inventory?tab=serials'}
        >
          Register serials
        </button>
        <span className="ml-1 text-muted-foreground">or change warehouse.</span>
      </div>
    )}
  </div>
)}
