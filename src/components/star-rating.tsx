export default function StarRating({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= score ? "text-amber-500" : "text-gray-300"}
        >
          ★
        </span>
      ))}
    </div>
  );
}
