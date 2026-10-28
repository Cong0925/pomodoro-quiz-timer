/* 元素拖动 composable：Pointer Events（鼠标/触屏通吃）、视口内限制、localStorage 位置记忆 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Ref } from 'vue'

export interface DragPos {
  x: number
  y: number
}

/** 判定为拖动的最小移动距离（px），低于阈值仍视为点击 */
const DRAG_THRESHOLD = 5

export function useDraggable(
  elRef: Ref<HTMLElement | null>,
  storageKey: string,
  defaultOffset: { right: number; top: number } = { right: 24, top: 24 }
) {
  const pos = ref<DragPos>({ x: 0, y: 0 })
  const dragging = ref(false)
  /** 位置已算好（localStorage 或默认值），初始化前隐藏元素避免首帧闪现 0,0 */
  const ready = ref(false)

  /* 拖动内部状态 */
  let pointerId = -1
  let offsetX = 0
  let offsetY = 0
  let startNX = 0
  let startNY = 0

  function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), Math.max(min, max))
  }

  /* 限制在视口内，不许拖出屏幕 */
  function clampToViewport(p: DragPos): DragPos {
    const el = elRef.value
    const w = el ? el.offsetWidth : 0
    const h = el ? el.offsetHeight : 0
    return {
      x: clamp(p.x, 0, window.innerWidth - w),
      y: clamp(p.y, 0, window.innerHeight - h),
    }
  }

  function loadPos(): void {
    let p: DragPos | null = null
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof (parsed as DragPos).x === 'number' &&
          typeof (parsed as DragPos).y === 'number'
        ) {
          p = { x: (parsed as DragPos).x, y: (parsed as DragPos).y }
        }
      }
    } catch (e) {
      console.warn(`【拖动位置读取失败】键名 ${storageKey}，已回退默认位置`, e)
    }
    if (!p) {
      /* 默认位置：距右、距上 defaultOffset（初始为右上角） */
      const el = elRef.value
      p = {
        x: window.innerWidth - (el?.offsetWidth ?? 0) - defaultOffset.right,
        y: defaultOffset.top,
      }
    }
    pos.value = clampToViewport(p)
  }

  function savePos(): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pos.value))
    } catch (e) {
      console.warn(`【拖动位置保存失败】键名 ${storageKey}`, e)
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return
    const el = elRef.value
    if (!el) return
    const nx = e.clientX - offsetX
    const ny = e.clientY - offsetY
    /* 移动超阈值才进入拖动模式（小抖动仍算点击） */
    if (!dragging.value && (Math.abs(nx - startNX) > DRAG_THRESHOLD || Math.abs(ny - startNY) > DRAG_THRESHOLD)) {
      dragging.value = true
    }
    if (!dragging.value) return
    pos.value = clampToViewport({ x: nx, y: ny })
  }

  /* 拖动结束后吞掉紧随的 click，避免松手时误触发元素原有点击行为 */
  function swallowClick(ev: Event): void {
    ev.stopPropagation()
    ev.preventDefault()
  }

  function removeMoveListeners(): void {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return
    removeMoveListeners()
    if (dragging.value) {
      savePos()
      elRef.value?.addEventListener('click', swallowClick, { capture: true, once: true })
    }
    dragging.value = false
    pointerId = -1
  }

  function onPointerDown(e: PointerEvent): void {
    const el = elRef.value
    if (!el || !ready.value) return
    /* 鼠标仅响应左键；触屏/笔无按键概念直接响应 */
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const rect = el.getBoundingClientRect()
    offsetX = e.clientX - rect.left
    offsetY = e.clientY - rect.top
    startNX = rect.left
    startNY = rect.top
    pointerId = e.pointerId
    try {
      /* 捕获指针：拖出元素范围后仍能收到 move/up */
      el.setPointerCapture(e.pointerId)
    } catch (err) {
      console.warn('【指针捕获失败】拖动可能在移出元素后中断', err)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  /* 窗口尺寸变化后重新钳制，防止位置跑出视口 */
  function onResize(): void {
    pos.value = clampToViewport(pos.value)
  }

  onMounted(() => {
    loadPos()
    ready.value = true
    window.addEventListener('resize', onResize)
  })

  onBeforeUnmount(() => {
    removeMoveListeners()
    window.removeEventListener('resize', onResize)
  })

  return { pos, dragging, ready, onPointerDown }
}
