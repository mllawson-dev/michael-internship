import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import EthImage from "../images/ethereum.svg";
import Skeleton from "../components/UI/Skeleton";
import "./ItemDetails.css";

const DETAILS_URL = "https://us-central1-nft-cloud-functions.cloudfunctions.net/itemDetails";
const DEFAULT_NFT_ID = "17914494";
const validId = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

function validDetails(item, nftId) {
  return item && item.nftId === Number(nftId) &&
    [item.title, item.description, item.nftImage, item.ownerName, item.ownerImage,
      item.creatorName, item.creatorImage].every(nonempty) &&
    validId(item.ownerId) && validId(item.creatorId) &&
    ((typeof item.tag === "string" && nonempty(item.tag)) || Number.isFinite(item.tag)) &&
    [item.price, item.likes, item.views].every((value) => Number.isFinite(value) && value >= 0);
}

function ItemAuthor({ label, name, image, authorId }) {
  const href = `/author?authorId=${authorId}`;
  return (
    <div className="item-details-person">
      <h6>{label}</h6>
      <div className="item_author">
        <div className="author_list_pp">
          <Link to={href} aria-label={`View ${label.toLowerCase()} ${name}`}>
            <img className="lazy" src={image} alt="" />
            <i className="fa fa-check" aria-hidden="true"></i>
          </Link>
        </div>
        <div className="author_list_info"><Link to={href}>{name}</Link></div>
      </div>
    </div>
  );
}

function ItemDetailsContent({ nftId }) {
  const identityValid = validId(nftId);
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState(identityValid ? "loading" : "error");

  useEffect(() => {
    // Fail closed: reject invalid IDs before fetching and mismatched identities before rendering.
    if (!identityValid) return;
    const controller = new AbortController();
    async function loadItem() {
      try {
        const response = await fetch(`${DETAILS_URL}?nftId=${nftId}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load item");
        const body = await response.text();
        const data = body.trim() ? JSON.parse(body) : null;
        if (data !== null && !validDetails(data, nftId)) throw new Error("Invalid item details");
        if (!controller.signal.aborted) {
          setItem(data);
          setStatus("success");
        }
      } catch (error) {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    loadItem();
    return () => controller.abort();
  }, [nftId, identityValid]);

  return (
    <section aria-label="Item details" className="mt90 sm-mt-0">
      <div className="container">
        {status === "loading" && (
          <div role="status" aria-label="Loading item details" aria-busy="true">
            <span className="item-details-sr-only">Loading item details…</span>
            <div className="row" aria-hidden="true">
              <div className="col-md-6 item-details-skeleton-image"><Skeleton width="100%" height="100%" borderRadius="8px" /></div>
              <div className="col-md-6 item-details-skeleton-info">
                <Skeleton width="75%" height="36px" borderRadius="4px" />
                <Skeleton width="40%" height="28px" borderRadius="4px" />
                <Skeleton width="100%" height="80px" borderRadius="4px" />
                <Skeleton width="60%" height="50px" borderRadius="4px" />
                <Skeleton width="60%" height="50px" borderRadius="4px" />
                <Skeleton width="35%" height="36px" borderRadius="4px" />
              </div>
            </div>
          </div>
        )}
        {status === "error" && <p role="alert">Unable to load item details. Please try again later.</p>}
        {status === "success" && !item && <p role="status">Item not found.</p>}
        {status === "success" && item && (
          <div className="row">
            <div className="col-md-6 text-center">
              <img src={item.nftImage} className="img-fluid img-rounded mb-sm-30 nft-image" alt={item.title} />
            </div>
            <div className="col-md-6">
              <div className="item_info">
                <h2>{item.title} #{String(item.tag).replace(/^#/, "")}</h2>
                <div className="item_info_counts">
                  <div className="item_info_views" aria-label={`${item.views} views`}><i className="fa fa-eye" aria-hidden="true"></i>{item.views}</div>
                  <div className="item_info_like" aria-label={`${item.likes} likes`}><i className="fa fa-heart" aria-hidden="true"></i>{item.likes}</div>
                </div>
                <p>{item.description}</p>
                <ItemAuthor label="Owner" name={item.ownerName} image={item.ownerImage} authorId={item.ownerId} />
                <div className="de_tab tab_simple">
                  <div className="de_tab_content">
                    <ItemAuthor label="Creator" name={item.creatorName} image={item.creatorImage} authorId={item.creatorId} />
                  </div>
                  <div className="spacer-40"></div>
                  <h6>Price</h6>
                  <div className="nft-item-price" aria-label={`${item.price} ETH`}>
                    <img src={EthImage} alt="" /><span>{item.price} <span className="item-details-sr-only">ETH</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ItemDetails() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const nftId = params.get("nftId") ?? params.get("nftid") ?? DEFAULT_NFT_ID;
  useEffect(() => { window.scrollTo(0, 0); }, [nftId]);
  return (
    <div id="wrapper" className="item-details-page">
      <div className="no-bottom no-top" id="content">
        <div id="top"></div>
        <ItemDetailsContent key={nftId} nftId={nftId} />
      </div>
    </div>
  );
}
