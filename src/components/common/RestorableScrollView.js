import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';

const positions = new Map();

export function clearSavedScrollPosition(screenKey) {
  if (screenKey) positions.delete(String(screenKey));
}

export function RestorableScrollView({ screenKey, onScroll, onContentSizeChange, onLayout, scrollEventThrottle = 16, style, ...props }) {
  const ref = useRef(null);
  const restoredKey = useRef(null);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const key = String(screenKey || 'screen');

  const restore = useCallback(() => {
    if (restoredKey.current === key) return;
    const y = Math.max(0, Number(positions.get(key) || 0));
    const maxY = Math.max(0, contentHeight.current - viewportHeight.current);
    const targetY = Math.min(y, maxY || y);
    restoredKey.current = key;
    requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: targetY, animated: false });
      if (targetY > 0) setTimeout(() => ref.current?.scrollTo({ y: targetY, animated: false }), 40);
    });
  }, [key]);

  useEffect(() => {
    restoredKey.current = null;
    requestAnimationFrame(restore);
  }, [key, restore]);

  const handleContentSizeChange = useCallback((width, height) => {
    contentHeight.current = height || 0;
    restore();
    if (onContentSizeChange) onContentSizeChange(width, height);
  }, [onContentSizeChange, restore]);

  const handleLayout = useCallback((event) => {
    viewportHeight.current = event?.nativeEvent?.layout?.height || 0;
    restore();
    if (onLayout) onLayout(event);
  }, [onLayout, restore]);

  const handleScroll = useCallback((event) => {
    const y = Math.max(0, event?.nativeEvent?.contentOffset?.y || 0);
    positions.set(key, y);
    if (onScroll) onScroll(event);
  }, [key, onScroll]);

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      {...props}
      style={[{ flex: 1 }, style]}
      onLayout={handleLayout}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}
      scrollEventThrottle={scrollEventThrottle}
    />
  );
}
