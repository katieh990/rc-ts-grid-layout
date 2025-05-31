import type { CSSProperties, SyntheticEvent, ReactElement } from 'react';
import type { ResizableProps, ResizeCallbackData, ResizeHandle } from 'react-resizable';
import type { DroppingPosition, RGLProps } from './type.rgl';
import type { DraggableEvent, DraggableData } from 'react-draggable';
import type { Position } from './type';

type GridDragEvent = {
	e: DraggableEvent;
	node: HTMLElement;
	position: Pick<Position, 'left' | 'top'>;
};
type GridResizeEvent = {
	e: SyntheticEvent;
	node: HTMLElement;
	size: ResizeCallbackData['size'];
	handle: ResizeCallbackData['handle'];
};

type GridItemCallback<T> = (i: string, w: number, h: number, Data: T) => void;

export interface Resizing {
	top: number;
	left: number;
	width: number;
	height: number;
}
export interface Dragging {
	top: number;
	left: number;
}

export interface ItemProps extends Pick<RGLProps, 'wrapperProps'> {
	children: ReactElement;
	cols: number;
	containerWidth: number;
	margin: [number, number];
	containerPadding?: [number, number];
	rowHeight: number;
	maxRows: number;

	isDraggable: boolean;
	isResizable: boolean;
	isBounded: boolean;
	static?: boolean;
	useCSSTransforms?: boolean;
	usePercentages?: boolean;
	transformScale: number;
	droppingPosition?: DroppingPosition;
	autoHeight?: boolean;

	className?: string;
	style?: CSSProperties;

	cancel?: string;
	handle?: string;

	x: number;
	y: number;
	w: number;
	h: number;

	minW?: number;
	maxW?: number;
	minH?: number;
	maxH?: number;
	i: string;

	resizeHandles?: ResizeHandle[];
	resizeHandle?: ResizableProps['handle'];

	onDrag?: GridItemCallback<GridDragEvent>;
	onDragStart?: GridItemCallback<GridDragEvent>;
	onDragStop?: GridItemCallback<GridDragEvent>;
	onResize?: GridItemCallback<GridResizeEvent>;
	onResizeStart?: GridItemCallback<GridResizeEvent>;
	onResizeStop?: GridItemCallback<GridResizeEvent>;
}