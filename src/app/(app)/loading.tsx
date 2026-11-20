import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-60 w-full" />
      <span className="sr-only">🍊 بنجهّز الصفحة… لحظة واحدة جاري التحميل</span>
    </div>
  );
}
