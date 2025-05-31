import {
	useState,
	useMemo,
	Children,
	useRef,
	memo,
	useCallback,
	useLayoutEffect,
	useEffect,
} from 'react';
import {
	bottom,
	cloneLayoutItem,
	compact,
	fastRGLPropsEqual,
	compactType as genCompactType,
	getAllCollisions,
	getLayoutItem,
	moveElement,
	noop,
	synchronizeLayoutWithChildren,
	withLayoutItem,
} from './utils';
import GridItem from './item';
import { deepEqual } from './equals';
import { calcXY } from './calculate';
import { flushSync } from 'react-dom';
import { layoutClassName } from './constant';
import { isEqual } from 'lodash';
import './grid.css';
import 'react-resizable/css/styles.css';
import type { DragEventHandler, ReactElement, ReactNode, FC } from 'react';
import type { DragNativeEvent, DroppingPosition, RGLProps } from './type.rgl';
import type { Layout, LayoutItem } from './type';
import type { ItemProps } from './type.item';
import type { ResizeHandle } from 'react-resizable';

type Rect = Pick<ItemProps, 'w' | 'h' | 'x' | 'y' | 'i'> & {
	from: 'drag' | 'resize';
	static: true;
};

type DragHandler = DragEventHandler<HTMLDivElement>;

const defaultMargin = [10, 10] as [number, number];
const defaultResizeHandles: ResizeHandle[] = ['se'];
const defaultLayout: Layout = [];
const defaultDroppingItem = {
	i: '__dropping-elem__',
	h: 1,
	w: 1,
};

const GridLayout: FC<RGLProps> = memo(
	({
		innerRef,
		autoSize = true,
		cols = 12,
		className = '',
		style = {},
		draggableHandle = '',
		draggableCancel = '',
		rowHeight = 150,
		maxRows = Infinity,
		layout = defaultLayout,
		margin = defaultMargin,
		isBounded = false,
		isDraggable = true,
		isResizable = true,
		allowOverlap = false,
		isDroppable = false,
		useCSSTransforms = true,
		transformScale = 1,
		verticalCompact = true,
		compactType = 'vertical',
		preventCollision = false,
		droppingItem = defaultDroppingItem,
		resizeHandles = defaultResizeHandles,
		containerPadding,
		children,
		width,
		onLayoutChange = noop,
		onDrop = noop,
		onDropDragOver = noop,
		resizeHandle,
		onDrag = noop,
		onDragStart = noop,
		onDragStop = noop,
		onResizeStart = noop,
		onResize = noop,
		onResizeStop = noop,
		mergeStyle = false,
		attributes = {},
		wrapperProps,
	}) => {
		useEffect(() => {
			return () => {
				console.log('unmounted gird');
			};
		}, []);

		const lastLayout = useRef<Layout>(layout);
		const old = useRef<LayoutItem>();
		const droppingDOM = useRef<ReactElement>();
		const lastRect = useRef<Rect>();
		const resizing = useRef(false);
		const dragEnterCount = useRef(0);

		const innerCompactType = useMemo(
			() =>
				genCompactType({
					compactType,
					verticalCompact,
				}),
			[compactType, verticalCompact],
		);

		const latestLayout = useMemo(() => {
			const next = synchronizeLayoutWithChildren(
				layout,
				children,
				cols,
				innerCompactType,
				allowOverlap,
			);
			return next;
		}, [allowOverlap, children, cols, innerCompactType, layout]);

		const [droppingPosition, setDroppingPosition] = useState<DroppingPosition>();
		const [innerLayout, setInnerLayout] = useState<Layout>(latestLayout);

		const innerPropsRef = useRef({
			layout: innerLayout,
			compactType: innerCompactType,
		});

		lastLayout.current = layout;

		innerPropsRef.current = {
			layout: innerLayout,
			compactType: innerCompactType,
		};

		const [rect, setRect] = useState<Rect>();
		const [mounted, setMounted] = useState(false);

		const containerHeight = useMemo(() => {
			if (!autoSize) return;
			const nbRow = bottom(innerLayout);
			const containerPaddingY = Array.isArray(containerPadding)
				? containerPadding[1]
				: margin[1];
			return nbRow * rowHeight + (nbRow - 1) * margin[1] + containerPaddingY * 2 + 'px';
		}, [autoSize, containerPadding, innerLayout, margin, rowHeight]);

		const handleItemHeightChange = useCallback((itemId: string, newHeight: number) => {
			setInnerLayout((prevLayout) => {
				const updatedLayout = prevLayout.map((item) => {
					if (item.i === itemId) {
						return { ...item, h: newHeight };
					}
					return item;
				});
				
				return compact(updatedLayout, innerCompactType, cols, allowOverlap);
			});
		}, [cols, innerCompactType, allowOverlap]);

		const placeholder = useMemo(() => {
			if (rect) {
				const { w, h, x, y, i } = rect;
				const cls = `react-grid-placeholder ${
					resizing.current ? 'placeholder-resizing' : ''
				}`.trim();
				return (
					<GridItem
						key="grid-item-placeholder"
						w={w}
						h={h}
						x={x}
						y={y}
						i={i}
						className={cls}
						containerWidth={width}
						cols={cols}
						margin={margin}
						containerPadding={containerPadding}
						maxRows={maxRows}
						rowHeight={rowHeight}
						isDraggable={false}
						isResizable={false}
						isBounded={false}
						useCSSTransforms={useCSSTransforms}
						transformScale={transformScale}>
						<div
							key="item-placeholder"
							{...wrapperProps}
						/>
					</GridItem>
				);
			}
			return null;
		}, [
			cols,
			containerPadding,
			margin,
			maxRows,
			rect,
			rowHeight,
			transformScale,
			useCSSTransforms,
			width,
			wrapperProps,
		]);

		const onLayoutMaybeChanged = useCallback(
			(nextLayout: Layout, prevLayout: Layout) => {
				if (!deepEqual(prevLayout, nextLayout)) {
					onLayoutChange(nextLayout);
				}
			},
			[onLayoutChange],
		);

		const removeDroppingPlaceholder = useCallback(() => {
			const nextLayout = compact(
				innerLayout.filter((l) => l.i !== droppingItem.i),
				innerCompactType,
				cols,
				allowOverlap,
			);
			droppingDOM.current = void 0;
			old.current = void 0;
			flushSync(() => {
				setDroppingPosition(void 0);
				setInnerLayout(nextLayout);
			});
		}, [allowOverlap, cols, droppingItem.i, innerCompactType, innerLayout]);

		const preventBrowserNativeAction = useCallback((e: DragNativeEvent) => {
			e.preventDefault();
			e.stopPropagation();
		}, []);

		const onInnerDrop: DragHandler = useCallback(
			(e) => {
				preventBrowserNativeAction(e);
				const item = innerLayout.find((l) => l.i === droppingItem.i);
				dragEnterCount.current = 0;
				removeDroppingPlaceholder();
				if (typeof onDrop === 'function') {
					onDrop(innerLayout, item, e);
				} else {
					console.warn('there os no onDrop function');
				}
			},
			[
				droppingItem.i,
				innerLayout,
				onDrop,
				preventBrowserNativeAction,
				removeDroppingPlaceholder,
			],
		);

		const onInnerDragLeave: DragHandler = useCallback(
			(e) => {
				preventBrowserNativeAction(e);
				dragEnterCount.current--;
				if (dragEnterCount.current === 0) {
					removeDroppingPlaceholder();
				}
			},
			[preventBrowserNativeAction, removeDroppingPlaceholder],
		);

		const onInnerDragEnter: DragHandler = useCallback(
			(e) => {
				preventBrowserNativeAction(e);
				dragEnterCount.current++;
			},
			[preventBrowserNativeAction],
		);

		const onInnerDragOver: DragHandler = useCallback(
			(e) => {
				preventBrowserNativeAction(e);
				if (typeof onDropDragOver === 'function') {
					const onDragOverResult = onDropDragOver(e);
					if (onDragOverResult === false) {
						if (droppingDOM.current) {
							removeDroppingPlaceholder();
						}
						return false;
					}
					const { w, h, ...dropItem } = { ...droppingItem, ...onDragOverResult };
					const gridRect = e.currentTarget.getBoundingClientRect();
					const layerX = e.clientX - gridRect.left;
					const layerY = e.clientY - gridRect.top;
					const position = {
						left: layerX / transformScale,
						top: layerY / transformScale,
						e,
					};
					if (!droppingDOM.current) {
						if (typeof w !== 'undefined' && typeof h !== 'undefined') {
							const calcPosition = calcXY(
								{
									cols,
									margin,
									maxRows,
									rowHeight,
									containerWidth: width,
									containerPadding,
								},
								layerY,
								layerX,
								w,
								h,
							);
							droppingDOM.current = <div key={`drop-dom-${dropItem.i}`} />;
							setDroppingPosition(position);
							setInnerLayout((prev) => [
								...prev,
								{
									...dropItem,
									w,
									h,
									x: calcPosition.x,
									y: calcPosition.y,
									static: false,
									isDraggable: true,
								} as Layout[number],
							]);
						}
					} else {
						if (droppingPosition) {
							const { left, top } = droppingPosition;
							const shouldUpdatePosition = left !== layerX || top !== layerY;
							if (shouldUpdatePosition) {
								setDroppingPosition(position);
							}
						}
					}
				}
			},
			[
				cols,
				containerPadding,
				droppingItem,
				droppingPosition,
				margin,
				maxRows,
				onDropDragOver,
				preventBrowserNativeAction,
				removeDroppingPlaceholder,
				rowHeight,
				transformScale,
				width,
			],
		);

		const onInnerDragStart: Required<ItemProps>['onDragStart'] = useCallback(
			(i, _x, _y, { e, node }) => {
				const item = getLayoutItem(innerPropsRef.current.layout, i);
				if (item) {
					const { w, h, x, y } = item;
					const placeholder: Rect = {
						w,
						h,
						x,
						y,
						from: 'drag',
						i,
						static: true,
					};
					old.current = cloneLayoutItem(item);
					setRect(placeholder);
					lastRect.current = placeholder;
					if (typeof onDragStart === 'function') {
						onDragStart(innerPropsRef.current.layout, item, item, void 0, e, node);
					} else {
						console.warn('there is no onDragStart');
					}
				}
			},
			[onDragStart],
		);

		const onInnerDrag: Required<ItemProps>['onDrag'] = useCallback(
			(i, x, y, { e, node }) => {
				const item = getLayoutItem(innerPropsRef.current.layout, i);
				if (item) {
					const nextRect: Rect = {
						w: item.w,
						h: item.h,
						x: item.x,
						y: item.y,
						from: 'drag',
						i,
						static: true,
					};
					const isUserAction = true;
					const currentLayout = moveElement(
						innerPropsRef.current.layout,
						item,
						x,
						y,
						isUserAction,
						preventCollision,
						innerPropsRef.current.compactType,
						cols,
						allowOverlap,
					);
					flushSync(() => {
						const nextInnerLayout = allowOverlap
							? currentLayout
							: compact(currentLayout, innerPropsRef.current.compactType, cols);
						if (!isEqual(nextRect, lastRect.current)) {
							setRect(nextRect);
							lastRect.current = nextRect;
						}

						if (!isEqual(innerPropsRef.current.layout, nextInnerLayout)) {
							setInnerLayout(nextInnerLayout);
						}
					});
					if (typeof onDrag === 'function') {
						onDrag(currentLayout, old.current, item, nextRect, e, node);
					} else {
						console.warn('there is no onDrag');
					}
				}
			},
			[preventCollision, cols, allowOverlap, onDrag],
		);

		const onInnerDragStop: Required<ItemProps>['onDragStop'] = useCallback(
			(i, x, y, { e, node }) => {
				if (lastRect.current) {
					const item = getLayoutItem(innerPropsRef.current.layout, i);
					if (item) {
						const isUserAction = true;
						const currentLayout = moveElement(
							innerPropsRef.current.layout,
							item,
							x,
							y,
							isUserAction,
							preventCollision,
							innerPropsRef.current.compactType,
							cols,
							allowOverlap,
						);
						const nextLayout = allowOverlap
							? currentLayout
							: compact(currentLayout, innerPropsRef.current.compactType, cols);
						old.current = void 0;
						lastRect.current = void 0;
						flushSync(() => {
							setRect(void 0);
							if (!isEqual(innerPropsRef.current.layout, nextLayout)) {
								setInnerLayout(nextLayout);
							}
						});
						if (typeof onDragStop === 'function') {
							onDragStop(nextLayout, old.current, item, void 0, e, node);
						} else {
							console.warn('there is no onDragStop');
						}
					}
				}
			},
			[allowOverlap, cols, onDragStop, preventCollision],
		);

		const onInnerResizeStart: Required<ItemProps>['onResizeStart'] = useCallback(
			(i, _w, _h, { e, node }) => {
				const item = getLayoutItem(innerPropsRef.current.layout, i);
				if (item) {
					old.current = cloneLayoutItem(item);
					resizing.current = true;
					if (typeof onResizeStart === 'function') {
						onResizeStart(innerPropsRef.current.layout, item, item, void 0, e, node);
					} else {
						console.warn('there is no onResizeStart');
					}
				}
			},
			[onResizeStart],
		);

		const onInnerResize: Required<ItemProps>['onResize'] = useCallback(
			(i, w, h, { e, node, handle }) => {
				let shouldMoveItem = false;
				let x;
				let y;
				const [nextLayout, item] = withLayoutItem(
					innerPropsRef.current.layout,
					i,
					(item) => {
						let hasCollisions;
						x = item.x;
						y = item.y;
						if (['sw', 'w', 'nw', 'n', 'ne'].indexOf(handle) !== -1) {
							if (['sw', 'nw', 'w'].indexOf(handle) !== -1) {
								x = item.x + (item.w - w);
								w = item.x !== x && x < 0 ? item.w : w;
								x = x < 0 ? 0 : x;
							}

							if (['ne', 'n', 'nw'].indexOf(handle) !== -1) {
								y = item.y + (item.h - h);
								h = item.y !== y && y < 0 ? item.h : h;
								y = y < 0 ? 0 : y;
							}
							shouldMoveItem = true;
						}
						if (preventCollision && !allowOverlap) {
							const collisions = getAllCollisions(innerPropsRef.current.layout, {
								...item,
								w,
								h,
								x,
								y,
							}).filter((layoutItem) => layoutItem.i !== item.i);
							hasCollisions = collisions.length > 0;

							if (hasCollisions) {
								y = item.y;
								h = item.h;
								x = item.x;
								w = item.w;
								shouldMoveItem = false;
							}
						}

						item.w = w;
						item.h = h;

						return item;
					},
				);
				if (item) {
					let finalLayout = nextLayout;
					if (shouldMoveItem) {
						const isUserAction = true;
						finalLayout = moveElement(
							nextLayout,
							item,
							x,
							y,
							isUserAction,
							preventCollision,
							innerPropsRef.current.compactType,
							cols,
							allowOverlap,
						);
					}
					const placeholder: Rect = {
						w: item.w,
						h: item.h,
						x: item.x,
						y: item.y,
						i,
						from: 'resize',
						static: true,
					};
					if (typeof onResize === 'function') {
						onResize(finalLayout, old.current, item, placeholder, e, node);
					} else {
						console.warn('there is no onResize');
					}
					flushSync(() => {
						const nextInnerLayout = allowOverlap
							? finalLayout
							: compact(finalLayout, innerPropsRef.current.compactType, cols);
						if (!isEqual(lastRect.current, placeholder)) {
							setRect(placeholder);
							lastRect.current = placeholder;
						}
						if (!isEqual(innerPropsRef.current.layout, nextInnerLayout)) {
							setInnerLayout(nextInnerLayout);
						}
					});
				}
			},
			[allowOverlap, cols, onResize, preventCollision],
		);

		const onInnerResizeStop: Required<ItemProps>['onResizeStop'] = useCallback(
			(i, _w, _h, { e, node }) => {
				const item = getLayoutItem(innerPropsRef.current.layout, i);
				const nextLayout = allowOverlap
					? innerPropsRef.current.layout
					: compact(
							innerPropsRef.current.layout,
							innerPropsRef.current.compactType,
							cols,
						);
				const previousItem = old.current;
				lastRect.current = void 0;
				old.current = void 0;
				resizing.current = false;
				flushSync(() => {
					if (!isEqual(innerPropsRef.current.layout, nextLayout)) {
						setInnerLayout(nextLayout);
					}
					setRect(void 0);
				});
				if (typeof onResizeStop === 'function') {
					onResizeStop(nextLayout, previousItem, item, void 0, e, node);
				} else {
					console.warn('there is no onResizeStop');
				}
			},
			[allowOverlap, cols, onResizeStop],
		);

		const genGridItem = useCallback(
			(child: ReactNode, isDrop?: boolean) => {
				if (child && typeof child === 'object' && 'key' in child) {
					const item = getLayoutItem(innerLayout, String(child.key));
					if (!item) return null;

					const draggable =
						typeof item.isDraggable === 'boolean'
							? item.isDraggable
							: !item.static && isDraggable;
					const resizable =
						typeof item.isResizable === 'boolean'
							? item.isResizable
							: !item.static && isResizable;
					const resizeHandlesOptions = item.resizeHandles || resizeHandles;
					const bounded = draggable && isBounded && item.isBounded !== false;

					const gridItemProps = {
						key: `Grid-Item-${child.key}`,
						containerWidth: width,
						cols,
						margin,
						containerPadding,
						maxRows,
						rowHeight,
						cancel: draggableCancel,
						handle: draggableHandle,
						onDragStop: onInnerDragStop,
						onDragStart: onInnerDragStart,
						onDrag: onInnerDrag,
						onResizeStart: onInnerResizeStart,
						onResize: onInnerResize,
						onResizeStop: onInnerResizeStop,
						isDraggable: draggable,
						isResizable: resizable,
						isBounded: bounded,
						useCSSTransforms: useCSSTransforms && mounted,
						usePercentages: !mounted,
						transformScale,
						w: item.w,
						h: item.h,
						x: item.x,
						y: item.y,
						i: item.i,
						minH: item.minH,
						minW: item.minW,
						maxH: item.maxH,
						maxW: item.maxW,
						static: item.static,
						droppingPosition: isDrop ? droppingPosition : undefined,
						resizeHandles: resizeHandlesOptions,
						resizeHandle,
						wrapperProps,
					};

					return item.autoHeight ? (
						<AutoHeightItem
							{...gridItemProps}
							onHeightChange={(height) => handleItemHeightChange(item.i, height)}>
							{child}
						</AutoHeightItem>
					) : (
						<GridItem {...gridItemProps}>{child}</GridItem>
					);
				}
				return null;
			},
			[
				cols,
				containerPadding,
				draggableCancel,
				draggableHandle,
				droppingPosition,
				handleItemHeightChange,
				isBounded,
				isDraggable,
				isResizable,
				margin,
				maxRows,
				mounted,
				onInnerDrag,
				onInnerDragStart,
				onInnerDragStop,
				onInnerResize,
				onInnerResizeStart,
				onInnerResizeStop,
				resizeHandle,
				resizeHandles,
				rowHeight,
				transformScale,
				useCSSTransforms,
				width,
				innerLayout,
				wrapperProps,
			],
		);

		useEffect(() => {
			if (!lastRect.current) {
				setInnerLayout(latestLayout);
			}
		}, [latestLayout]);

		useLayoutEffect(() => {
			if (!mounted) {
				setMounted(true);
			}
		}, [mounted]);

		useEffect(() => {
			if (mounted) {
				onLayoutMaybeChanged(innerLayout, lastLayout.current);
			}
		}, [innerLayout, mounted, onLayoutMaybeChanged]);

		const mergedStyle = useMemo(() => {
			if (mergeStyle) {
				return {
					height: containerHeight,
					...style,
				};
			}
			return style;
		}, [mergeStyle, containerHeight, style]);

		const mergedClassName = useMemo(
			() => `${layoutClassName} ${className || ''}`.trimEnd(),
			[className],
		);

		return (
			<div
				ref={innerRef}
				className={mergedClassName}
				style={mergedStyle}
				onDrop={isDroppable ? onInnerDrop : noop}
				onDragLeave={isDroppable ? onInnerDragLeave : noop}
				onDragEnter={isDroppable ? onInnerDragEnter : noop}
				onDragOver={isDroppable ? onInnerDragOver : noop}
				{...attributes}>
				<>
					{Children.map(children, (child) => genGridItem(child))}
					{isDroppable && droppingDOM.current && genGridItem(droppingDOM.current, true)}
					{placeholder}
				</>
			</div>
		);
	},
	(prev, next) =>
		prev.children === next.children && fastRGLPropsEqual(prev, next, isEqual),
);

export default GridLayout;