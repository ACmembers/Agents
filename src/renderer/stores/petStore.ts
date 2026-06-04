/**
 * 宠物状态管理（全局状态）
 *
 * 简单的发布-订阅模式，后续可替换为 Zustand / Jotai
 */

import type { PetState, PetAnimationState } from '../../shared/types'

type Listener = () => void

class PetStore {
  private state: PetState = {
    x: 0,
    y: 0,
    animation: 'idle',
    mood: 60,
    energy: 80,
    isVisible: true
  }

  private listeners: Set<Listener> = new Set()

  getState(): PetState {
    return { ...this.state }
  }

  setState(partial: Partial<PetState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  setAnimation(animation: PetAnimationState): void {
    this.state = { ...this.state, animation }
    this.notify()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn())
  }

  /** 从磁盘恢复状态 */
  async load(): Promise<void> {
    try {
      const saved = await window.deskpet.loadPetState()
      if (saved) {
        this.state = { ...this.state, ...saved }
        this.notify()
      }
    } catch {
      // 无保存状态，使用默认值
    }
  }

  /** 持久化到磁盘 */
  async persist(): Promise<void> {
    try {
      await window.deskpet.savePetState(this.state)
    } catch {
      // 静默失败
    }
  }
}

/** 全局单例 */
export const petStore = new PetStore()
