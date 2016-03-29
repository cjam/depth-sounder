///<reference path="all.d.ts"/>

// Motion

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

interface IDeviceOrientation {
    rotationRate : IRotation;
    compassHeading: number;
    interval: number;
    timestamp: number;
}

interface ITimestamp<T> {
    timestamp:number;
    value:T;
}

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
        return this.subscribeOnError(onError, thisArg);
    }

    public subscribeOnCompleted(onCompleted:()=>void, thisArg?:any):Rx.IDisposable {
        return this.subscribeOnCompleted(onCompleted, thisArg);
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

// todo: translate the classes below to typescript

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

var GravityScale = d3.scale.linear().domain([-9, 9]);
var GammaScale = d3.scale.linear().domain([-1, 1]);
var Gravity_To_Volume = GravityScale.range([0, 4]).clamp(true);
var swipe_threshold = 1;
var CompassScale = d3.scale.linear().domain([-90, 0, 90]);
var Compass_To_Volume = CompassScale.range([4, 0, 4]).clamp(true);
var Compass_To_X = CompassScale.range([-1, 0, 1]).clamp(true);

class DeviceMotionChannel {
    private socket:SocketIOClient.Socket;
    private viewModel:ChannelViewModel;
    private motion:RxMotion;

    public acceleration:KnockoutObservable<Vector>;
    public velocity:KnockoutObservable<Vector>;
    public position:KnockoutObservable<Vector>;

    public initialCompassHeading:number;

    constructor() {
        let self = this;
        this.motion = new RxMotion(10);
        this.socket = SocketManager.GetSocket("/device");
        this.initialCompassHeading = 0;

        this.socket.on("channel_updated", (data)=> {
            if (self.viewModel) {
                self.viewModel.apply(data);
                console.log("Updated view model", self.viewModel);
            }
        })

        this.socket.on("channel_added", (data)=> {
            if (!self.viewModel) {
                self.viewModel = new ChannelViewModel(data, {
                    autoEmit: true,
                    autoUpdate: false,
                    ioNamespace: "/device"
                });
                self.hookupMotion();
                console.log("Created view model", self.viewModel)
            }
        })
    }

    private hookupMotion() {
        let self = this;

        // store the first compass heading
        this.motion.compassHeading.first().subscribe((d)=> {
            this.initialCompassHeading = d;
        })

        this.motion.compassHeading.select((d)=> {
            let normalized = d - self.initialCompassHeading;
            if (normalized < 0) {
                normalized += 360;
            }
            // just some normalization to put it into a
            // continuous domain (i.e. 90 -> 90)
            normalized -= normalized > 180 ? 360 : 0;
            return Compass_To_X(normalized);
        }).subscribe(this.viewModel.x);

        //this.motion.averagePosition
        //    .select(v=>v.x)
        //    .do((x)=>console.log("x",x))
        //    .where(vx=>vx>10)
        //    .take(1)
        //    .subscribe((n)=>{
        //        console.log("yep",n);
        //    })


        //this.motion.velocity.where(vel=> {
        //    return Math.abs(vel.length()) > 1;
        //}).subscribe(n=> {
        //    console.log("Swiped " + (n > 0) ? "Left" : "Right");
        //})

        //this.motion.velocity.subscribe((n)=>{
        //    console.clear()
        //    console.log("velocity",n);
        //})

        //this.motion.position.subscribe((n)=> {
        //    console.log("position", n);
        //})

        // Wire up rotations
        this.motion.gamma.select(Math.round).subscribe(this.viewModel.gamma);
        this.motion.alpha.select(Math.round).subscribe(this.viewModel.alpha);
        this.motion.beta.select(Math.round).subscribe(this.viewModel.beta);
    }

}

//
//function ObservableMotion() {
//    var self = this;
//
//    var motionSchema = {
//        acceleration: {x: 0.0, y: 0.0, z: 0.0},
//        accelerationIncludingGravity: {x: 0.0, y: 0.0, z: 0.0},
//        rotationRate: {gamma: 0.0, alpha: 0.0, beta: 0.0},
//        interval: 0.0,
//        timestamp: 0
//    }
//
//    self.apply = function (event) {
//        var motionObj = {
//            acceleration: event.acceleration,
//            accelerationIncludingGravity: event.accelerationIncludingGravity,
//            rotationRate: event.rotationRate,
//            interval: event.interval,
//            timestamp: event.timestamp
//        }
//
//        ko.mapping.fromJS(motionObj, {}, self);
//    }
//
//    self.apply(motionSchema);
//
//    // Computed properties
//
//    var throttleMs = 100;
//
//    var _lastAccel = {x: 0.0, y: 0.0, z: 0.0};
//    var _velocity = {x: 0.0, y: 0.0, z: 0.0};
//    this.velocity = {
//        x: ko.computed(function () {
//            // ( Ax(t) - Ax(t-1) ) / 2 * interval = delta_acceleration
//            var current = self.acceleration.x();
//            var last = _lastAccel.x;
//            _lastAccel.x = current;
//            _velocity.x = _velocity.x + (current - last) / 2.0 * self.interval();
//            return _velocity.x;
//        }).extend({rateLimit: throttleMs}),
//        y: ko.computed(function () {
//            var current = self.acceleration.y();
//            var last = _lastAccel.y;
//            _lastAccel.y = current;
//            return (current - last) / 2.0 * self.interval();
//        }).extend({rateLimit: throttleMs}),
//        z: ko.computed(function () {
//            var current = self.acceleration.z();
//            var last = _lastAccel.z;
//            _lastAccel.z = current;
//            return (current - last) / 2.0 * self.interval();
//        }).extend({rateLimit: throttleMs})
//    }
//
//
//    var _lastVelocity = {x: 0.0, y: 0.0, z: 0.0};
//    var _position = {x: 0.0, y: 0.0, z: 0.0};
//    this.position = {
//        x: ko.computed(function () {
//            // ( Ax(t) - Ax(t-1) ) / 2 * interval = delta_acceleration
//            var current = self.velocity.x();
//            var last = _lastVelocity.x;
//            _lastVelocity.x = current;
//            _position.x = _position.x + (current - last) / 2.0 * self.interval();
//            return _position.x;
//        }).extend({rateLimit: throttleMs}),
//        y: ko.computed(function () {
//            var current = self.velocity.y();
//            var last = _lastVelocity.y;
//            _lastVelocity.y = current;
//            return (current - last) / 2.0 * self.interval();
//        }).extend({rateLimit: throttleMs}),
//        z: ko.computed(function () {
//            var current = self.velocity.z();
//            var last = _lastVelocity.z;
//            _lastVelocity.z = current;
//            return (current - last) / 2.0 * self.interval();
//        }).extend({rateLimit: throttleMs})
//    }
//}
//
//function DeviceMotionAdapter(updateInterval) {
//    var self = this;
//
//    this.isSupported = new ko.observable(false);
//    this.isTracking = new ko.observable(false);
//    this.motion = new ObservableMotion();
//
//
//    // Check if mobile
//    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && window.DeviceOrientationEvent) {
//        this.isSupported(true);
//    }
//
//    var deviceInfo = {
//        motion: {},
//        orientation: {}
//    }
//
//    var pushDeviceInfo = function () {
//        if (self.isTracking()) {
//            deviceSocket.emit("changed", deviceInfo);
//        }
//    }
//
//    var handleMotionEvent = function (event) {
//        deviceInfo.motion = event;
//        self.motion.apply(event);
//    }
//
//    var handleOrientationEvent = function (event) {
//        deviceInfo.orientation = event;
//    }
//
//    if (this.isSupported()) {
//        var deviceSocket = io("/device")
//        deviceSocket.on('connect', function (evt) {
//            deviceInfo.id = deviceSocket.id;
//        });
//    }
//
//    var subscription = -1;
//    this.isTracking.subscribe(function (val) {
//        // todo: check if we're already subscribed?
//        if (val) {
//            console.log("Subscribing to device motion");
//            window.addEventListener("devicemotion", handleMotionEvent, true);
//            window.addEventListener("deviceorientation", handleOrientationEvent, true);
//
//            if (!updateInterval) {
//                updateInterval = 10000;
//            }
//            subscription = setInterval(pushDeviceInfo, updateInterval)
//        } else {
//            window.removeEventListener("devicemotion", handleMotionEvent, true);
//            window.removeEventListener("deviceorientation", handleOrientationEvent, true)
//            clearInterval(subscription);
//        }
//    })
//}

