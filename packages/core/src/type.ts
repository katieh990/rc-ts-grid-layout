export type CompactType = 'vertical' | 'horizontal' | undefined;

export interface Position {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface LayoutItem {
	w: number;
	h: number;
	x: number;
	y: number;
	i: string;
	minW?: number;
	minH?: number;
	maxW?: number;
	maxH?: number;
	moved?: boolean;
	static?: boolean;
	isDraggable?: boolean;
	isResizable?: boolean;
	isBounded?: boolean;
	resizeHandles?: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'>;
	autoHeight?: boolean; // New property for auto-height support
}

export type Layout = Array<LayoutItem>;