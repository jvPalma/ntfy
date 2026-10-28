import * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// Fork: chat-order scrolling for a single topic (newest message at the bottom, like the
// "ntfy jv" Android fork). The scroll container is the app's shared #main element.
// - Opens at the bottom, and jumps to the bottom whenever a newer message arrives.
// - Loads older messages when the top of the list comes near, keeping the reading position.
// - While the view is at the bottom, it stays there as late content (Markdown, images) grows.

const PINNED_THRESHOLD_PX = 80;

const mainElement = () => document.getElementById("main");

const isNearBottom = (main) => main.scrollHeight - main.scrollTop - main.clientHeight <= PINNED_THRESHOLD_PX;

const scrollToBottom = () => {
  const main = mainElement();
  if (main) {
    main.scrollTop = main.scrollHeight;
  }
};

const ChatOrderScroll = ({ id, newestId, count, hasMore, onLoadMore, children }) => {
  const contentRef = useRef(null);
  const sentinelRef = useRef(null);
  const pinnedRef = useRef(true);
  const distanceFromBottomRef = useRef(null);

  const loadMore = useCallback(() => {
    const main = mainElement();
    if (main) {
      // The observer can fire before the scroll event that would unpin, so check the position now
      pinnedRef.current = isNearBottom(main);
      distanceFromBottomRef.current = main.scrollHeight - main.scrollTop;
    }
    onLoadMore();
  }, [onLoadMore]);

  // Pinned while the view is at (or near) the bottom
  useEffect(() => {
    const main = mainElement();
    if (!main) {
      return undefined;
    }
    const handleScroll = () => {
      pinnedRef.current = isNearBottom(main);
    };
    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, []);

  // Opening a topic, or a newer message arriving, always goes to the bottom
  useLayoutEffect(() => {
    pinnedRef.current = true;
    scrollToBottom();
  }, [id, newestId]);

  // After older messages render above, restore the distance from the bottom so nothing jumps
  useLayoutEffect(() => {
    const main = mainElement();
    if (main && distanceFromBottomRef.current !== null) {
      main.scrollTop = main.scrollHeight - distanceFromBottomRef.current;
      distanceFromBottomRef.current = null;
    }
  }, [count]);

  // Load older messages when the top sentinel comes within 300px of the viewport
  useEffect(() => {
    const main = mainElement();
    const sentinel = sentinelRef.current;
    if (!main || !sentinel || !hasMore) {
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && loadMore(), {
      root: main,
      rootMargin: "300px 0px 0px 0px",
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, count, loadMore]);

  // Late content (lazy Markdown, images) must not push the newest message out of view
  useEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return undefined;
    }
    const observer = new ResizeObserver(() => pinnedRef.current && scrollToBottom());
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={contentRef}>
      <div ref={sentinelRef} />
      {children}
    </div>
  );
};

export default ChatOrderScroll;
