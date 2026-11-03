import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AuthorBanner from "../images/author_banner.jpg";
import AuthorItems from "../components/author/AuthorItems";
import Skeleton from "../components/UI/Skeleton";
import { validItem } from "../components/UI/ItemCard";
import "../components/author/Author.css";

const AUTHORS_URL = "https://us-central1-nft-cloud-functions.cloudfunctions.net/authors";
const DEFAULT_AUTHOR_ID = "83937449";
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

function validAuthor(author, authorId) {
  return author && author.authorId === Number(authorId) &&
    [author.authorName, author.tag, author.address, author.authorImage].every(nonempty) &&
    Number.isFinite(author.followers) && author.followers >= 0 &&
    Array.isArray(author.nftCollection) && author.nftCollection.every((item) => validItem({
      ...item, authorId: author.authorId, authorImage: author.authorImage, expiryDate: null,
    }));
}

function AuthorProfile({ authorId }) {
  const validId = /^\d+$/.test(authorId) && Number.isSafeInteger(Number(authorId)) && Number(authorId) > 0;
  const [author, setAuthor] = useState(null);
  const [status, setStatus] = useState(validId ? "loading" : "error");
  // This read-only API has no follow mutation: the requested toggle is local to this profile visit.
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    // Fail closed: invalid identities never trigger a request or display a guessed profile.
    if (!validId) return;
    const controller = new AbortController();
    async function loadAuthor() {
      try {
        const response = await fetch(`${AUTHORS_URL}?author=${authorId}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load author");
        const body = await response.text();
        const data = body.trim() ? JSON.parse(body) : null;
        if (data !== null && !validAuthor(data, authorId)) throw new Error("Invalid author");
        if (!controller.signal.aborted) {
          setAuthor(data);
          setStatus("success");
        }
      } catch (error) {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    loadAuthor();
    return () => controller.abort();
  }, [authorId, validId]);

  return (
    <section className="author-profile" aria-label="Author profile">
      <div className="container">
        {status === "loading" && (
          <div role="status" aria-label="Loading author" aria-busy="true">
            <span className="author-sr-only">Loading author…</span>
            <div className="author-profile-skeleton" aria-hidden="true">
              <Skeleton width="150px" height="150px" borderRadius="50%" />
              <div><Skeleton width="200px" height="28px" borderRadius="4px" />
                <Skeleton width="160px" height="20px" borderRadius="4px" /></div>
            </div>
            <AuthorItems loading />
          </div>
        )}
        {status === "error" && <p role="alert">Unable to load author. Please try again later.</p>}
        {status === "success" && !author && <p role="status">Author not found.</p>}
        {status === "success" && author && (
          <div className="row">
            <div className="col-md-12">
              <div className="d_profile de-flex">
                <div className="de-flex-col">
                  <div className="profile_avatar">
                    <img src={author.authorImage} alt={author.authorName} />
                    <i className="fa fa-check" aria-hidden="true"></i>
                    <div className="profile_name">
                      <h1>{author.authorName}
                        <span className="profile_username">@{author.tag.replace(/^@/, "")}</span>
                        <span id="wallet" className="profile_wallet" title={author.address}>{author.address}</span>
                        <button type="button" id="btn_copy" title="Copy Text">Copy</button>
                      </h1>
                    </div>
                  </div>
                </div>
                <div className="profile_follow de-flex">
                  <div className="de-flex-col">
                    <div className="profile_follower">{author.followers + (following ? 1 : 0)} followers</div>
                    <button type="button" className="btn-main" aria-pressed={following}
                      onClick={() => setFollowing((value) => !value)}>
                      {following ? "Unfollow" : "Follow"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-12"><div className="de_tab tab_simple"><AuthorItems author={author} /></div></div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Author() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const authorId = params.get("authorId") ?? params.get("author") ?? DEFAULT_AUTHOR_ID;
  return (
    <div id="wrapper" className="author-page">
      <div className="no-bottom no-top" id="content">
        <div id="top"></div>
        <section id="profile_banner" aria-label="Author banner" className="text-light"
          style={{ background: `url(${AuthorBanner}) top` }}></section>
        <AuthorProfile key={authorId} authorId={authorId} />
      </div>
    </div>
  );
}
