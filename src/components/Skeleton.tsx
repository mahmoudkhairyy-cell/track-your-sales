// هياكل تحميل بتتشكل زي الشاشة الحقيقية. الحركة بتتوقف لو المستخدم فعّل تقليل الحركة (CSS).
export function Bone({ className = "" }: { className?: string }) {
  return <div className={`skeleton-bone rounded-2xl ${className}`} aria-hidden="true" />;
}

export function HomeSkeleton({ label = "بنحمّل لوحة الأداء" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-4 pb-5" role="status" aria-label={label}>
      <Bone className="h-36 rounded-[28px] sm:h-40" />
      <Bone className="h-16 rounded-[22px]" />
      <div className="grid grid-cols-2 gap-3">
        <Bone className="h-28 rounded-[22px]" />
        <Bone className="h-24" />
      </div>
      <Bone className="h-24" />
      <Bone className="h-24" />
      <Bone className="h-24" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
