// Vector2.ts
export interface Vector2 {
    x: number;
    y: number;
  }
  
  export const fvec2 = {
    create: (x: number = 0, y: number = 0): Vector2 => ({ x, y }),
    
    add: (a: Vector2, b: Vector2): Vector2 => ({
      x: a.x + b.x,
      y: a.y + b.y,
    }),
    
    subtract: (a: Vector2, b: Vector2): Vector2 => ({
      x: a.x - b.x,
      y: a.y - b.y,
    }),
    
    multiply: (v: Vector2, scalar: number): Vector2 => ({
      x: v.x * scalar,
      y: v.y * scalar,
    }),
    
    // Mutating version
    addInPlace: (target: Vector2, other: Vector2): void => {
      target.x += other.x;
      target.y += other.y;
    },
  };