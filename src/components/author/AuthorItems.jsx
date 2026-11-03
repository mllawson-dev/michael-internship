import React from "react";
import ItemCard, { ItemCardSkeleton } from "../UI/ItemCard";

export default function AuthorItems({ author, loading = false }) {
  if (loading) return (
    <div className="author-items-grid" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <ItemCardSkeleton key={index} />)}
    </div>
  );
  if (!author.nftCollection.length) return <p role="status">No items available from this author.</p>;
  return (
    <ul className="author-items-grid" aria-label="Author items">
      {author.nftCollection.map((item) => (
        <li key={item.id}>
          {/* The author collection API supplies no countdown dates; reuse the shared card without a timer. */}
          <ItemCard item={{ ...item, authorId: author.authorId, authorImage: author.authorImage, expiryDate: null }} />
        </li>
      ))}
    </ul>
  );
}
