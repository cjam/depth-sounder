///<reference path="all.d.ts"/>

// DEVICE MOTION

import Observable = Rx.Observable;
interface IRotation {
    gamma:number;
    alpha:number;
    beta:number;
}

interface IDeviceMotion {
    acceleration: IVector;
    accelerationIncludingGravity : IVector;
    rotationRate : number;
    interval: number;
    timestamp: number;
}

// DEVICE ORIENTATION

interface IDeviceOrientation {
    rotationRate : IRotation;
    compassHeading: number;
    interval: number;
    timestamp: number;
}

// EXTENSIONS

class IntegratingObservable extends Rx.Observable implements Rx.IObservable<Vector> {
    public subscribe(observer:Rx.Observer<Vector>):Rx.IDisposable {
        return this.integration.subscribe(observer);
    }

    public subscribe(onNext?:(value:Vector)=>void, onError?:(exception:any)=>void, onCompleted?:()=>void):Rx.IDisposable {
        return this.integration.subscribe(onNext, onError, onCompleted);
    }

    public subscribeOnNext(onNext:(value:Vector)=>void, thisArg?:any):Rx.IDisposable {
        return this.integration.subscribeOnNext(onNext, thisArg);
    }

    public subscribeOnError(onError:(exception:any)=>void, thisArg?:any):Rx.IDisposable {
        return this.integration.subscribeOnError(onError, thisArg);
    }

    public subscribeOnCompleted(onCompleted:()=>void, thisArg?:any):Rx.IDisposable {
        return this.integration.subscribeOnCompleted(onCompleted, thisArg);
    }

    private integratedValue:Vector;
    private integration:Rx.Observable<Vector>;

    constructor(private source:Rx.Observable<Vector> | IntegratingObservable, scheduler?:Rx.IScheduler) {
        super()
        // initial seed
        let self = this;
        this.integratedValue = new Vector();
        this.integration = (<Rx.Observable<Vector>>this.source).timestamp(scheduler)
            .bufferWithCount(2, 1)       // take two samples hopping 1 sample every time
            .select(v_buf=> {
                let v1 = v_buf[0];  // accel 1
                let v2 = v_buf[1];  // accel 2
                if (v1 != undefined && v2 != undefined) {
                    let dt = (v2.timestamp - v1.timestamp) / 1000;  // delta time (seconds)
                    // take the average of the two vectors and multiply by the time in between
                    let integrated_vec = v2.value.add(v1.value).divide(2.0).multiply(dt);
                    return integrated_vec
                } else {
                    return new Vector();
                }
            })
            .scan((vel, integrated)=> {
                self.integratedValue = self.integratedValue.add(integrated)
                return self.integratedValue
            }, this.integratedValue)
    }

    public reset() {
        console.log("resetting integration");
        this.integratedValue = new Vector();

    }
}

Rx.Observable.Integrate = function ():IntegratingObservable {
    var source:Rx.Observable<Vector> = this;
    return new IntegratingObservable(source);
}


/// RxMotion wrapper class for motion api
class RxMotion {
    private accel_threshold:Vector = new Vector(0.2, 0.2, 0.2);
    private vel_threshold:Vector = new Vector(0.2, 0.2, 0.2);
    private pos_threshold:Vector = new Vector(0.5, 0.5, 0.5);

    public isSupported:KnockoutObservable<boolean>
    public samplingInterval:KnockoutObservable<number>

    private _disposable:CompositeDisposable;
    private _motionSubject:Rx.Subject<IDeviceMotion>;
    private _orientationSubject:Rx.Subject<IDeviceOrientation>;

    // Device Motion
    public motion:Rx.Observable<IDeviceMotion>
    public acceleration:Rx.Observable<Vector>
    public accelerationIncludingGravity:Rx.Observable<Vector>
    public rotationRate:Rx.Observable<number>

    public averageAcceleration:Rx.Observable<Vector>;

    // Calculated integrals
    public velocity:IntegratingObservable;
    public averageVelocity:Rx.Observable<Vector>;
    public position:IntegratingObservable;
    public averagePosition:Rx.Observable<Vector>;

    // Device Orientation
    public orientation:Rx.Observable<IDeviceOrientation>;
    public gamma:Rx.Observable<number>;
    public beta:Rx.Observable<number>;
    public alpha:Rx.Observable<number>;
    public compassHeading:Rx.Observable<number>;

    // Just wrapping the device motion events in an observable
    private __motionObservable = Rx.Observable.fromEventPattern(
        (h:(ev)=>void)=>window.addEventListener("devicemotion", h),
        (h:(ev)=>void)=>window.removeEventListener("devicemotion", h)
    )
    private __orientationObservable = Rx.Observable.fromEventPattern(
        (h:(ev)=>void)=>window.addEventListener("deviceorientation", h),
        (h:(ev)=>void)=>window.removeEventListener("deviceorientation", h)
    )

    constructor(samplingInterval?:number) {
        this.samplingInterval = ko.observable<number>();
        this.isSupported = ko.observable<boolean>(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && window.DeviceOrientationEvent != undefined);
        this._disposable = new Rx.CompositeDisposable();

        this._motionSubject = new Rx.Subject<IDeviceMotion>();
        this._orientationSubject = new Rx.Subject<IDeviceOrientation>();

        // Device Motion
        this.motion = this._motionSubject.asObservable();

        this.acceleration = this.motion.pluck<IVector>("acceleration").select(Vector.fromData);
        this.averageAcceleration = RxMotion.vectorAverage(this.acceleration, 100, this.accel_threshold);

        this.accelerationIncludingGravity = RxMotion.vectorAverage(this.motion.pluck<IVector>("accelerationIncludingGravity").select(Vector.fromData), 100, this.accel_threshold);
        ;
        this.rotationRate = this.motion.pluck<number>("rotationRate");

        this.velocity = new IntegratingObservable(this.averageAcceleration)
        this.averageVelocity = RxMotion.vectorAverage(this.velocity, 100, this.vel_threshold);

        this.position = new IntegratingObservable(this.velocity);
        this.averagePosition = RxMotion.vectorAverage(this.position, 100, this.pos_threshold);

        // Device Orientation
        this.orientation = this._orientationSubject.asObservable();
        this.gamma = this.orientation.pluck<number>("gamma");
        this.beta = this.orientation.pluck<number>("beta");
        this.alpha = this.orientation.pluck<number>("alpha");
        this.compassHeading = this.orientation.pluck<number>("webkitCompassHeading");

        if (!this.isSupported) {
            console.warn("Motion API not supported on this device");
        } else {
            // when the sampling interval changes we want to resubscribe to the observables
            // luckily this only has
            this.samplingInterval.subscribe(this.handleSampleIntervalChanged, this)
        }

        // Set the sampling interval to initialize things
        this.samplingInterval(samplingInterval || 100);
    }

    public static vectorAverage<Vector>(source:Rx.Observable<Vector>, numSamples:number = 100, threshold:Vector = new Vector()):Rx.Observable<Vector> {
        return source.bufferWithCount(numSamples, 1)
            .select((samples:Vector[])=> {
                var temp = new Vector();
                samples.forEach((s)=> {
                    temp = temp.add(s);
                })
                temp = temp.divide(samples.length)
                temp.x = Math.abs(temp.x) < threshold.x ? 0 : temp.x;
                temp.y = Math.abs(temp.y) < threshold.y ? 0 : temp.y;
                temp.z = Math.abs(temp.z) < threshold.z ? 0 : temp.z;
                return temp;
            });
    }

    private handleSampleIntervalChanged(newInterval) {
        console.log("RxMotion.samplingInterval set", newInterval)

        // dispose of previous subscriptions
        if (this._disposable.length > 0) {
            this._disposable.dispose();
        }
        this._disposable = new Rx.CompositeDisposable();
        if (newInterval > 0) {
            this._disposable.add(this.__motionObservable.sample(newInterval).subscribe(this._motionSubject));
            this._disposable.add(this.__orientationObservable.sample(newInterval).subscribe(this._orientationSubject));
        } else {
            console.info("RxMotion sampling turned off")
        }
    }
}






