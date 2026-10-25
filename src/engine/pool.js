// Ported unchanged from the original (HelpDeskSurvivor src/engine/).
// Fixed-capacity object pool. Live objects are items[0..count); all objects are
// allocated once up front so spawning and killing never allocate.
//
// Removal swaps the dead object with the last live one, so iterate backwards when
// removing during a loop, or mark objects dead and call compact() afterwards.

export class Pool {
  constructor(capacity, factory) {
    this.items = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.items[i] = factory();
    this.count = 0;
  }
  get capacity() {
    return this.items.length;
  }
  get full() {
    return this.count >= this.items.length;
  }
  // Returns a recycled object (caller must reset its fields) or null when full.
  spawn() {
    return this.count < this.items.length ? this.items[this.count++] : null;
  }
  removeAt(i) {
    const last = --this.count;
    const tmp = this.items[i];
    this.items[i] = this.items[last];
    this.items[last] = tmp;
  }
  // Removes every live object whose `dead` flag is set.
  compact() {
    for (let i = this.count - 1; i >= 0; i--) if (this.items[i].dead) this.removeAt(i);
  }
  clear() {
    this.count = 0;
  }
}
