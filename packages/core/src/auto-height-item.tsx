import { useEffect, useRef, useState, useCallback } from 'react';
import { debounce } from 'lodash';
import type { FC, ReactElement } from 'react';
import type { ItemProps } from './type.item';
import type { Layout } from './type';

interface AutoHeightItemProps extends ItemProps {
  onHeightChange: (height: number) => void;
}

const AutoHeightItem: FC<AutoHeightItemProps> = ({
  children,
  rowHeight,
  onHeightChange,
  ...props
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState<number>(props.h * rowHeight);

  const updateHeight = useCallback(
    debounce((newHeight: number) => {
      const gridUnits = Math.ceil(newHeight / rowHeight);
      if (gridUnits !== props.h) {
        onHeightChange(gridUnits);
      }
    }, 100),
    [rowHeight, props.h, onHeightChange]
  );

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    observerRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        setHeight(newHeight);
        updateHeight(newHeight);
      }
    });

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
      updateHeight.cancel();
    };
  }, [updateHeight]);

  const child = children as ReactElement;
  return (
    <div ref={contentRef} style={{ height: 'auto', width: '100%' }}>
      {child}
    </div>
  );
};

export default AutoHeightItem;