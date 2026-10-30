import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Slider from "react-slick";
import Skeleton from "../UI/Skeleton";
import "slick-carousel/slick/slick.css";
import "./NewItems.css";

const NEW_ITEMS_URL =
  "https://us-central1-nft-cloud-functions.cloudfunctions.net/newItems";

function validItem(item) {
  return item &&
    Number.isFinite(item.id) && Number.isFinite(item.authorId) &&
    Number.isFinite(item.nftId) &&
    typeof item.title === "string" && item.title.trim() &&
    typeof item.authorImage === "string" && item.authorImage.trim() &&
    typeof item.nftImage === "string" && item.nftImage.trim() &&
    Number.isFinite(item.price) && item.price >= 0 &&
    Number.isFinite(item.likes) && item.likes >= 0 &&
    (item.expiryDate === null || Number.isFinite(item.expiryDate));
}

function Countdown({ expiryDate, now }) {
  const remaining = Math.max(0, Math.ceil((expiryDate - now) / 1000));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return (
    <div className="de_countdown" aria-label={`Time remaining: ${hours} hours ${minutes} minutes ${seconds} seconds`}>
      {hours}h {minutes}m {seconds}s
    </div>
  );
}

function CarouselArrow({ direction, onClick }) {
  return (
    <button type="button" className={`new-items-arrow new-items-arrow-${direction}`}
      aria-label={`${direction === "prev" ? "Previous" : "Next"} new items`} onClick={onClick}>
      <span aria-hidden="true">{direction === "prev" ? "‹" : "›"}</span>
    </button>
  );
}

const NewItems = () => {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const controller = new AbortController();
    async function loadItems() {
      try {
        const response = await fetch(NEW_ITEMS_URL, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load new items");
        const data = await response.json();
        // Fail closed: malformed responses show an error instead of invented card data.
        if (!Array.isArray(data) || !data.every(validItem)) throw new Error("Invalid new items");
        if (!controller.signal.aborted) {
          setNow(Date.now());
          setItems(data);
          setStatus("success");
        }
      } catch (error) {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    loadItems();
    return () => controller.abort();
  }, []);

  const hasActiveCountdown = items.some(
    (item) => item.expiryDate !== null && item.expiryDate > now
  );

  useEffect(() => {
    if (!hasActiveCountdown) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasActiveCountdown]);

  const settings = {
    infinite: true,
    slidesToShow: 4,
    slidesToScroll: 1,
    speed: 500,
    arrows: true,
    accessibility: true,
    prevArrow: <CarouselArrow direction="prev" />,
    nextArrow: <CarouselArrow direction="next" />,
    responsive: [
      { breakpoint: 1199, settings: { slidesToShow: 3 } },
      { breakpoint: 991, settings: { slidesToShow: 2 } },
      { breakpoint: 575, settings: { slidesToShow: 1 } },
    ],
  };

  return (
    <section id="section-items" className="no-bottom new-items" aria-labelledby="new-items-heading">
      <div className="container">
        <div className="text-center">
          <h2 id="new-items-heading">New Items</h2>
          <div className="small-border bg-color-2"></div>
        </div>
        {status === "loading" && (
          <div role="status" aria-label="Loading new items" aria-busy="true">
            <span className="new-items-sr-only">Loading new items…</span>
            <div className="new-items-skeletons" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="new-items-slide" key={index}>
                  <div className="nft__item">
                    <div className="author_list_pp"><Skeleton width="50px" height="50px" borderRadius="50%" /></div>
                    <div className="nft__item_wrap"><Skeleton width="100%" height="260px" borderRadius="8px" /></div>
                    <Skeleton width="75%" height="20px" borderRadius="4px" />
                    <div className="new-items-skeleton-price"><Skeleton width="45%" height="16px" borderRadius="4px" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {status === "error" && <p role="alert" className="text-center">Unable to load new items. Please try again later.</p>}
        {status === "success" && items.length === 0 && <p role="status" className="text-center">No new items available.</p>}
        {status === "success" && items.length > 0 && (
          <div className="new-items-carousel" role="list" aria-label="New items carousel">
            <Slider {...settings}>
              {items.map((item) => (
                <div className="new-items-slide" role="listitem" key={item.id}>
                  <article className="nft__item" aria-label={item.title}>
                    <div className="author_list_pp">
                      <Link to={`/author?authorId=${item.authorId}`} aria-label={`View creator of ${item.title}`}>
                        <img className="lazy" src={item.authorImage} alt="" />
                        <i className="fa fa-check" aria-hidden="true"></i>
                      </Link>
                    </div>
                    {item.expiryDate !== null && <Countdown expiryDate={item.expiryDate} now={now} />}
                    <div className="nft__item_wrap">
                      <Link to={`/item-details?nftId=${item.nftId}`}>
                        <img src={item.nftImage} className="lazy nft__item_preview" alt={item.title} />
                      </Link>
                    </div>
                    <div className="nft__item_info">
                      <Link to={`/item-details?nftId=${item.nftId}`}><h4>{item.title}</h4></Link>
                      <div className="nft__item_price">{item.price} ETH</div>
                      <div className="nft__item_like" aria-label={`${item.likes} likes`}>
                        <i className="fa fa-heart" aria-hidden="true"></i><span>{item.likes}</span>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </Slider>
          </div>
        )}
      </div>
    </section>
  );
};

export default NewItems;
