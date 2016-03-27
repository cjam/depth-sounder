///<reference path="all.d.ts"/>

interface IVector {
    x:number;
    y:number;
    z:number;
}

class Vector implements IVector {

    constructor(public x:number = 0, public y:number = 0, public z:number = 0) {
    }

    private apply(data:IVector) {
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.z = data.z || 0;
    }

    public negative():Vector {
        return new Vector(-this.x, -this.y, -this.z);
    }

    public add(v):Vector {
        if (v instanceof Vector) return new Vector(this.x + v.x, this.y + v.y, this.z + v.z);
        else return new Vector(this.x + v, this.y + v, this.z + v);
    }

    public subtract(v):Vector {
        if (v instanceof Vector) return new Vector(this.x - v.x, this.y - v.y, this.z - v.z);
        else return new Vector(this.x - v, this.y - v, this.z - v);
    }

    public multiply(v):Vector {
        if (v instanceof Vector) return new Vector(this.x * v.x, this.y * v.y, this.z * v.z);
        else return new Vector(this.x * v, this.y * v, this.z * v);
    }

    public divide(v):Vector {
        if (v instanceof Vector) return new Vector(this.x / v.x, this.y / v.y, this.z / v.z);
        else return new Vector(this.x / v, this.y / v, this.z / v);
    }

    public equals(v):boolean {
        return this.x == v.x && this.y == v.y && this.z == v.z;
    }

    public dot(v):number {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    public cross(v):Vector {
        return new Vector(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    public length() {
        return Math.sqrt(this.dot(this));
    }

    public unit():Vector {
        return this.divide(this.length());
    }

    public min():number {
        return Math.min(Math.min(this.x, this.y), this.z);
    }

    public max():number {
        return Math.max(Math.max(this.x, this.y), this.z);
    }

    public toAngles():{theta:number,phi:number} {
        return {
            theta: Math.atan2(this.z, this.x),
            phi: Math.asin(this.y / this.length())
        };
    }

    public angleTo(a):number {
        return Math.acos(this.dot(a) / (this.length() * a.length()));
    }

    public toArray(n):number[] {
        return [this.x, this.y, this.z].slice(0, n || 3);
    }

    public clone():Vector {
        return new Vector(this.x, this.y, this.z);
    }

    // Static Methods

    public static fromData(data:IVector):Vector {
        let vec = new Vector();
        vec.apply(data);
        return vec;
    }

    public static fromAngles(theta:number, phi:number):Vector {
        return new Vector(Math.cos(theta) * Math.cos(phi), Math.sin(phi), Math.sin(theta) * Math.cos(phi));
    }

    public static randomDirection():Vector {
        return Vector.fromAngles(Math.random() * Math.PI * 2, Math.asin(Math.random() * 2 - 1));
    }

    public static min(a:Vector, b:Vector):Vector {
        return new Vector(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
    }

    public static max(a:Vector, b:Vector):Vector {
        return new Vector(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
    }

    public static lerp(a:Vector, b:Vector, fraction:number):Vector {
        return b.subtract(a).multiply(fraction).add(a);
    }

    public static fromArray(a:number[]):Vector {
        return new Vector(a[0], a[1], a[2]);
    }

    public static angleBetween(a:Vector, b:Vector):number {
        return a.angleTo(b);
    }

}