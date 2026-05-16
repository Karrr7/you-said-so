export default function FeedDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 my-1">
      <div className="flex-1 h-px bg-[#21262d]" />
      <span className="text-[10px] font-bold tracking-widest uppercase text-[#6e7681]">{label}</span>
      <div className="flex-1 h-px bg-[#21262d]" />
    </div>
  )
}
