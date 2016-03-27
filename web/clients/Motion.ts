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
    subscribe(observer:Rx.Observer<Vector>):Rx.IDisposable {
        return this.integration.subscribe(observer);
    }

    subscribe(onNext?:(value:Vector)=>void, onError?:(exception:any)=>void, onCompleted?:()=>void):Rx.IDisposable {
        return this.integration.subscribe(onNext, onError, onCompleted);
    }

    subscribeOnNext(onNext:(value:Vector)=>void, thisArg?:any):Rx.IDisposable {
        return this.integration.subscribeOnNext(onNext, thisArg);
    }

    subscribeOnError(onError:(exception:any)=>void, thisArg?:any):Rx.IDisposable {
        return this.subscribeOnError(onError, thisArg);
    }

    subscribeOnCompleted(onCompleted:()=>void, thisArg?:any):Rx.IDisposable {
        return this.subscribeOnCompleted(onCompleted, thisArg);
    }

    private integratedValue:Vector;
    private source:IObservable<Vector>;

    private integration:IObservable<Vector>;

    constructor(source:Rx.Observable<Vector>) {
        super()
        // initial seed
        this.integratedValue = new Vector();
        this.integration = source.timestamp()
            .bufferWithCount(2, 1)       // take two samples hopping 1 sample every time
            .select(v_buf=> {
                let v1 = v_buf[0];  // accel 1
                let v2 = v_buf[1];  // accel 2
                let dt = (v2.timestamp - v1.timestamp) / 1000;  // delta time (seconds)
                // take difference of vectors and multiply by the delta time
                let integrated_vec = v2.value.subtract(v1.value).multiply(dt);
                return integrated_vec
            })
            .scan((vel, integrated)=> {
                this.integratedValue = this.integratedValue.add(integrated)
                return this.integratedValue
            }, this.integratedValue)
    }

    public reset() {
        console.log("resetting integration");
        this.integratedValue = new Vector();

    }
}

//Rx.Observable.Integrate = function() : IntegratingObservable{
//    var source : Rx.Observable<Vector> = this;
//    return new IntegratingObservable(source);
//}

// todo: translate the classes below to typescript

class RxMotion {
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
    public velocity:IntegratingObservable;
    public position:IntegratingObservable;

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
        this.accelerationIncludingGravity = this.motion.pluck<IVector>("accelerationIncludingGravity").select(Vector.fromData);
        this.rotationRate = this.motion.pluck<number>("rotationRate");

        this.velocity = new IntegratingObservable(this.acceleration);
        this.position = new IntegratingObservable(this.velocity);

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
        ;

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


class DeviceMotionChannel {
    private socket:SocketIOClient.Socket;
    private viewModel:ChannelViewModel;
    private motion:RxMotion;

    constructor() {
        let self = this;
        this.motion = new RxMotion(20);
        this.socket = SocketManager.GetSocket("/device");
        ;

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

    private MovingAverage<T>(source:IObservable<T>, numSamples) {
        // todo: this would be great
    }

    private hookupMotion() {
        this.motion.accelerationIncludingGravity.select(a=> {
            return Gravity_To_Volume(a.z);
        }).subscribe(this.viewModel.gain)

        //this.motion.velocity.where(vel=> {
        //    return Math.abs(vel.length()) > 1;
        //}).subscribe(n=> {
        //    console.log("Swiped " + (n > 0) ? "Left" : "Right");
        //})

        this.motion.position.subscribe((n)=> {
            //console.log("position", n);
        })

        var self = this;
        setTimeout(function () {
            self.motion.position.reset()
        }, 4000)

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

