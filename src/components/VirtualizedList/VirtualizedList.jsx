import React, { useRef, forwardRef, useCallback, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import cx from "classnames";
import { VariableSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { getNormalizedItems, easeInOutQuint, getMaxOffset } from "./virtualized-list-service";
import useMergeRefs from "../../hooks/useMergeRefs";
import "./VirtualizedList.scss";

const VirtualizedList = forwardRef(
  (
    {
      className,
      id,
      items,
      itemRenderer,
      getItemHeight,
      onScroll,
      overscanCount,
      getItemId,
      scrollToId,
      scrollDuration,
      onScrollToFinished
    },
    ref
  ) => {
    // Refs
    const componentRef = useRef(null);
    const listRef = useRef(null);
    const scrollTopRef = useRef(0);
    const offsetHeightRef = useRef(0);
    const animationDataRef = useRef({});
    const mergedRef = useMergeRefs({ refs: [ref, componentRef] });

    const animationData = animationDataRef.current;
    if (!animationData.initialized) {
      animationData.initialized = true;
      animationData.scrollOffsetInitial = 0;
      animationData.scrollOffsetFinal = 0;
      animationData.animationStartTime = 0;
    }

    // Memos
    // Creates object of itemId => { item, index, height, offsetTop}
    const normalizedItems = useMemo(() => {
      return getNormalizedItems(items, getItemId, getItemHeight);
    }, [items, getItemId, getItemHeight]);

    const maxListOffset = useMemo(() => {
      return getMaxOffset(offsetHeightRef.current, normalizedItems);
    }, [offsetHeightRef, normalizedItems]);

    // Callbacks
    const onScrollCB = useCallback(
      ({ scrollDirection, scrollOffset, scrollUpdateWasRequested }) => {
        scrollTopRef.current = scrollOffset;
        if (!scrollUpdateWasRequested) {
          animationData.scrollOffsetInitial = scrollOffset;
        }
        onScroll && onScroll(scrollDirection, scrollOffset, scrollUpdateWasRequested);
      },
      [onScroll, scrollTopRef, animationData]
    );

    const onAnimationComplete = useCallback(() => {
      onScrollToFinished && onScrollToFinished();
    }, [onScrollToFinished]);

    const animateScroll = useCallback(() => {
      requestAnimationFrame(() => {
        const now = performance.now();
        const ellapsed = now - animationData.animationStartTime;
        const scrollDelta = animationData.scrollOffsetFinal - animationData.scrollOffsetInitial;
        const easedTime = easeInOutQuint(Math.min(1, ellapsed / scrollDuration));
        const scrollOffset = animationData.scrollOffsetInitial + scrollDelta * easedTime;

        listRef.current.scrollTo(Math.min(maxListOffset, scrollOffset));

        if (ellapsed < scrollDuration) {
          animateScroll();
        } else {
          animationData.animationStartTime = undefined;
          animationData.scrollOffsetInitial = animationData.scrollOffsetFinal;
          onAnimationComplete();
        }
      });
    }, [scrollDuration, animationData, listRef, maxListOffset, onAnimationComplete]);

    const startScrollAnimation = useCallback(
      item => {
        const { offsetTop } = item;
        if (animationData.animationStartTime || animationData.scrollOffsetFinal === offsetTop) {
          // animation already in progress or final offset equals to item offset
          return;
        }

        animationData.scrollOffsetFinal = offsetTop;
        animationData.animationStartTime = performance.now();
        animateScroll();
      },
      [animationData, animateScroll]
    );

    // Effects
    useEffect(() => {
      // scroll to specific item
      if (scrollToId && listRef.current) {
        const item = normalizedItems[scrollToId];
        // listRef.current.scrollToItem(item.index, "center");
        item && startScrollAnimation(item);
      }
    }, [scrollToId, startScrollAnimation, normalizedItems]);

    const rowRenderer = ({ index, style }) => {
      const item = items[index];
      return itemRenderer(item, index, style);
    };

    const calcItemHeight = index => {
      const item = items[index];
      return getItemHeight(item, index);
    };

    return (
      <div ref={mergedRef} className={cx("virtualized-list--wrapper", className)} id={id}>
        <AutoSizer>
          {({ height, width }) => {
            offsetHeightRef.current = height;
            return (
              <List
                ref={listRef}
                height={height}
                width={width}
                itemCount={items.length}
                itemSize={calcItemHeight}
                onScroll={onScrollCB}
                overscanCount={overscanCount}
              >
                {rowRenderer}
              </List>
            );
          }}
        </AutoSizer>
      </div>
    );
  }
);

VirtualizedList.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.object),
  getItemHeight: PropTypes.func,
  getItemId: PropTypes.func,
  onScrollToFinished: PropTypes.func,
  overscanCount: PropTypes.number,
  scrollDuration: PropTypes.number
};
VirtualizedList.defaultProps = {
  className: "",
  id: "",
  items: [],
  getItemHeight: (item, _index) => item.height,
  getItemId: (item, _index) => item.id,
  onScrollToFinished: () => {},
  overscanCount: 0,
  scrollDuration: 300
};

export default VirtualizedList;
